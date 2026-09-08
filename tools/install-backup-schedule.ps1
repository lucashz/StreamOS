param(
  [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')][string]$At = '03:00',
  [ValidateRange(1, 3650)][int]$RetentionDays = 14
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BackupScript = (Resolve-Path (Join-Path $PSScriptRoot 'backup-local.ps1')).Path
$TaskName = 'StreamOS Daily Backup'
$PowerShell = (Get-Command powershell.exe).Source
$Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$BackupScript`" -RetentionDays $RetentionDays"
$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument $Arguments -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -Daily -At $At
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Backup diário do PostgreSQL e uploads do StreamOS' -Force | Out-Null
Write-Host "Tarefa '$TaskName' instalada para $At com retenção de $RetentionDays dias."
