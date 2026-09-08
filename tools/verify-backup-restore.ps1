param([string]$BackupPath = '')

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $BackupPath) {
  & (Join-Path $PSScriptRoot 'backup-local.ps1')
  $BackupPath = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot '.runtime\backups') -Directory |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
$ResolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
$AllowedRoot = [IO.Path]::GetFullPath((Join-Path $ProjectRoot '.runtime\backups'))
if (-not $ResolvedBackup.StartsWith($AllowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Diretório de backup fora da área permitida' }
$ManifestPath = Join-Path $ResolvedBackup 'manifest.json'
$SqlPath = Join-Path $ResolvedBackup 'database.sql'
if (-not (Test-Path -LiteralPath $ManifestPath) -or -not (Test-Path -LiteralPath $SqlPath)) { throw 'Backup incompleto' }
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
foreach ($File in $Manifest.files) {
  $Target = Join-Path $ResolvedBackup $File.name
  if (-not (Test-Path -LiteralPath $Target)) { throw "Arquivo ausente: $($File.name)" }
  $Hash = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Hash -ne $File.sha256) { throw "Hash inválido: $($File.name)" }
}

$Database = "streamos_restore_test_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
Push-Location $ProjectRoot
try {
  docker compose up -d --wait postgres | Out-Host
  docker compose exec -T postgres createdb -U streamos $Database
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar banco temporário' }
  Get-Content -LiteralPath $SqlPath -Raw | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U streamos -d $Database | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao restaurar dump' }
  $Tables = docker compose exec -T postgres psql -U streamos -d $Database -tAc "select count(*) from information_schema.tables where table_schema='public'"
  if ([int]$Tables -lt 10) { throw "Restauração incompleta: apenas $Tables tabelas" }
  Write-Host "Restauração validada em banco temporário ($Tables tabelas)."
} finally {
  docker compose exec -T postgres dropdb -U streamos --if-exists $Database | Out-Null
  Pop-Location
}
