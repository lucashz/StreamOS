param(
  [string]$Destination = "",
  [ValidateRange(1, 3650)][int]$RetentionDays = 14
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (-not $Destination) {
  $Destination = Join-Path $ProjectRoot ".runtime\backups\streamos-$Timestamp"
}
$BackupPath = [IO.Path]::GetFullPath($Destination)
$AllowedRoot = [IO.Path]::GetFullPath((Join-Path $ProjectRoot '.runtime\backups'))
if (-not $BackupPath.StartsWith($AllowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "O backup deve permanecer em $AllowedRoot"
}
New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null

Push-Location $ProjectRoot
try {
  docker compose up -d --wait postgres | Out-Host
  $Sql = docker compose exec -T postgres pg_dump -U streamos -d streamos --clean --if-exists --no-owner --no-privileges | Out-String
  if ($LASTEXITCODE -ne 0 -or -not $Sql.Trim()) { throw 'Falha ao gerar dump do PostgreSQL' }
  [IO.File]::WriteAllText((Join-Path $BackupPath 'database.sql'), $Sql, [Text.UTF8Encoding]::new($false))

  $Uploads = Join-Path $ProjectRoot '.runtime\uploads'
  if (Test-Path -LiteralPath $Uploads) {
    Compress-Archive -LiteralPath $Uploads -DestinationPath (Join-Path $BackupPath 'uploads.zip') -Force
  }
  $Files = Get-ChildItem -LiteralPath $BackupPath -File | ForEach-Object {
    [ordered]@{ name = $_.Name; bytes = $_.Length; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
  $Manifest = [ordered]@{ version = 1; createdAt = (Get-Date).ToUniversalTime().ToString('o'); files = @($Files) } | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText((Join-Path $BackupPath 'manifest.json'), $Manifest, [Text.UTF8Encoding]::new($false))
  $Cutoff = (Get-Date).AddDays(-$RetentionDays)
  $Expired = Get-ChildItem -LiteralPath $AllowedRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $Cutoff -and $_.FullName -ne $BackupPath }
  foreach ($Directory in $Expired) {
    $ResolvedExpired = [IO.Path]::GetFullPath($Directory.FullName)
    if (-not $ResolvedExpired.StartsWith($AllowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Backup expirado fora da área permitida: $ResolvedExpired"
    }
    Remove-Item -LiteralPath $ResolvedExpired -Recurse -Force
  }
  Write-Host "Backup criado em $BackupPath"
  Write-Host "Retenção aplicada: $RetentionDays dias; removidos $(@($Expired).Count) backups expirados"
} finally {
  Pop-Location
}
