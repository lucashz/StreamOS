param([switch]$IncludeInfrastructure)

$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$PidRoot = Join-Path $ProjectRoot '.runtime\pids'

function Stop-ProcessTree([int]$RootProcessId) {
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) { Stop-ProcessTree $child.ProcessId }
  Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $PidRoot) {
  Get-ChildItem -LiteralPath $PidRoot -Filter '*.pid' | ForEach-Object {
    $processId = [int](Get-Content -LiteralPath $_.FullName -Raw)
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Stop-ProcessTree $processId
      Write-Host "Encerrado $($_.BaseName) (PID $processId)"
    }
    Remove-Item -LiteralPath $_.FullName -Force
  }
}

if ($IncludeInfrastructure) {
  Push-Location $ProjectRoot
  try { docker compose down } finally { Pop-Location }
}
