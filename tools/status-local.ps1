$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$PidRoot = Join-Path $ProjectRoot '.runtime\pids'

$targets = @(
  @{ Name = 'PostgreSQL'; Port = 55432 },
  @{ Name = 'Redis'; Port = 6379 },
  @{ Name = 'Mailpit'; Port = 8025 },
  @{ Name = 'Web'; Port = 3000 },
  @{ Name = 'API'; Port = 3001 },
  @{ Name = 'Realtime'; Port = 3002 },
  @{ Name = 'Overlay'; Port = 3003 }
)

$rows = foreach ($target in $targets) {
  $connection = Get-NetTCPConnection -State Listen -LocalPort $target.Port -ErrorAction SilentlyContinue | Select-Object -First 1
  [pscustomobject]@{
    Service = $target.Name
    Porta = $target.Port
    Estado = if ($connection) { 'ATIVO' } else { 'INATIVO' }
    PID = if ($connection) { $connection.OwningProcess } else { '-' }
  }
}

$workerPidFile = Join-Path $PidRoot 'worker.pid'
$workerPid = if (Test-Path -LiteralPath $workerPidFile) { [int](Get-Content -LiteralPath $workerPidFile -Raw) } else { 0 }
$worker = if ($workerPid -gt 0) { Get-Process -Id $workerPid -ErrorAction SilentlyContinue } else { $null }
$rows += [pscustomobject]@{ Service = 'Worker'; Porta = '-'; Estado = if ($worker) { 'ATIVO' } else { 'INATIVO' }; PID = if ($worker) { $worker.Id } else { '-' } }

$rows | Format-Table -AutoSize

try {
  $ready = Invoke-RestMethod -TimeoutSec 3 'http://localhost:3001/health/ready'
  Write-Host "API readiness: $($ready.status)" -ForegroundColor Green
} catch {
  Write-Warning 'API readiness: indisponível'
  exit 1
}

foreach ($health in @(
  @{ Name = 'Realtime'; Url = 'http://localhost:3002/health/live' },
  @{ Name = 'Overlay'; Url = 'http://localhost:3003/health/live' },
  @{ Name = 'Web'; Url = 'http://localhost:3000/health/live' }
)) {
  try {
    $response = Invoke-RestMethod -TimeoutSec 3 $health.Url
    if ($response.status -ne 'ok') { throw 'status inválido' }
    Write-Host "$($health.Name) liveness: ok" -ForegroundColor Green
  } catch {
    Write-Warning "$($health.Name) liveness: indisponível"
    exit 1
  }
}

if ($rows.Estado -contains 'INATIVO') { exit 1 }
