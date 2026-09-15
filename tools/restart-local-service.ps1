param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('worker', 'realtime')]
  [string]$Service,
  [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RuntimeRoot = [IO.Path]::GetFullPath((Join-Path $ProjectRoot '.runtime'))
$PidRoot = Join-Path $RuntimeRoot 'pids'
$LogRoot = Join-Path $RuntimeRoot 'logs'
$packages = @{ worker = '@streamos/worker'; realtime = '@streamos/realtime' }
$ports = @{ worker = 0; realtime = 3002 }
$pidFile = Join-Path $PidRoot "$Service.pid"

if (Test-Path -LiteralPath $pidFile) {
  $currentPid = [int](Get-Content -LiteralPath $pidFile -Raw)
  Stop-Process -Id $currentPid -Force -ErrorAction SilentlyContinue
}

$process = Start-Process -FilePath 'corepack.cmd' `
  -ArgumentList @('pnpm', 'exec', 'dotenv', '-e', '.env', '--', 'corepack', 'pnpm', '--filter', $packages[$Service], 'start') `
  -WorkingDirectory $ProjectRoot `
  -RedirectStandardOutput (Join-Path $LogRoot "$Service.out.log") `
  -RedirectStandardError (Join-Path $LogRoot "$Service.err.log") `
  -WindowStyle Hidden `
  -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  if ($process.HasExited) { throw "$Service encerrou durante o reinício" }
  if ($ports[$Service] -eq 0) {
    Start-Sleep -Seconds 2
    break
  }
  try {
    $healthy = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$($ports[$Service])/health/live").StatusCode -eq 200
  } catch {
    $healthy = $false
  }
  if ($healthy) { break }
  Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)

if ($ports[$Service] -gt 0 -and -not $healthy) {
  throw "Tempo esgotado aguardando $Service"
}

Write-Output "$Service reiniciado (PID $($process.Id))"
