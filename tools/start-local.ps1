param(
  [switch]$SkipBuild,
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RuntimeRoot = [IO.Path]::GetFullPath((Join-Path $ProjectRoot '.runtime'))
$PidRoot = Join-Path $RuntimeRoot 'pids'
$LogRoot = Join-Path $RuntimeRoot 'logs'
$Started = [Collections.Generic.List[object]]::new()

New-Item -ItemType Directory -Force -Path $PidRoot, $LogRoot | Out-Null

function Test-TcpPort([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    return $task.Wait(750) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-Until([scriptblock]$Check, [string]$Description) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (& $Check) { Write-Host "[OK] $Description" -ForegroundColor Green; return }
    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)
  throw "Tempo esgotado aguardando $Description"
}

function Start-DockerDesktop {
  cmd.exe /c 'docker info >nul 2>&1'
  if ($LASTEXITCODE -eq 0) { return }

  $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (-not (Test-Path -LiteralPath $dockerDesktop)) {
    throw 'Docker Desktop não está aberto e não foi encontrado neste computador.'
  }
  Write-Host '[...] Iniciando Docker Desktop'
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
  Wait-Until { cmd.exe /c 'docker info >nul 2>&1'; $LASTEXITCODE -eq 0 } 'Docker Desktop'
}

function Start-ServiceProcess([string]$Name, [string]$Package, [int]$Port = 0) {
  $pidFile = Join-Path $PidRoot "$Name.pid"
  if ($Port -eq 0 -and (Test-Path -LiteralPath $pidFile)) {
    $existingPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
      Write-Host "[OK] $Name já está em execução (PID $existingPid)" -ForegroundColor Green
      return
    }
    Remove-Item -LiteralPath $pidFile -Force
  }
  if ($Port -gt 0 -and (Test-TcpPort $Port)) {
    Write-Host "[OK] $Name já está ouvindo na porta $Port" -ForegroundColor Green
    return
  }

  $stdout = Join-Path $LogRoot "$Name.out.log"
  $stderr = Join-Path $LogRoot "$Name.err.log"
  $process = Start-Process -FilePath 'corepack.cmd' `
    -ArgumentList @('pnpm', 'exec', 'dotenv', '-e', '.env', '--', 'corepack', 'pnpm', '--filter', $Package, 'start') `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id
  $Started.Add([pscustomobject]@{ Name = $Name; Process = $process })

  if ($Port -gt 0) {
    Wait-Until {
      if ($process.HasExited) { throw "$Name encerrou com código $($process.ExitCode). Consulte $stderr" }
      Test-TcpPort $Port
    } "$Name na porta $Port"
  } else {
    Start-Sleep -Seconds 2
    if ($process.HasExited) { throw "$Name encerrou com código $($process.ExitCode). Consulte $stderr" }
    Write-Host "[OK] $Name em execução (PID $($process.Id))" -ForegroundColor Green
  }
}

try {
  Push-Location $ProjectRoot
  Start-DockerDesktop
  Write-Host '[...] Iniciando PostgreSQL, Redis e Mailpit'
  docker compose up -d --wait
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar a infraestrutura Docker.' }

  if (-not $SkipBuild) {
    Write-Host '[...] Compilando aplicações'
    corepack pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'A compilação falhou; nenhum serviço novo será iniciado.' }
  }

  Start-ServiceProcess 'api' '@streamos/api' 3001
  Wait-Until {
    try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:3001/health/ready').StatusCode -eq 200 } catch { $false }
  } 'API pronta com PostgreSQL e Redis'
  Start-ServiceProcess 'worker' '@streamos/worker'
  Start-ServiceProcess 'realtime' '@streamos/realtime' 3002
  Wait-Until {
    try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:3002/health/live').StatusCode -eq 200 } catch { $false }
  } 'Realtime saudável'
  Start-ServiceProcess 'overlay' '@streamos/overlay' 3003
  Wait-Until {
    try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:3003/health/live').StatusCode -eq 200 } catch { $false }
  } 'Overlay saudável'
  Start-ServiceProcess 'web' '@streamos/web' 3000
  Wait-Until {
    try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:3000/health/live').StatusCode -eq 200 } catch { $false }
  } 'Web saudável'

  Write-Host ''
  Write-Host 'StreamOS iniciado por completo.' -ForegroundColor Cyan
  Write-Host 'Web: http://localhost:3000 | API: http://localhost:3001 | Overlay: http://localhost:3003'
} catch {
  Write-Error $_
  foreach ($item in $Started) {
    if (-not $item.Process.HasExited) { Stop-Process -Id $item.Process.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath (Join-Path $PidRoot "$($item.Name).pid") -Force -ErrorAction SilentlyContinue
  }
  exit 1
} finally {
  Pop-Location
}
