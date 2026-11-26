<#
.SYNOPSIS
    毎朝7:00自動実行タスクをWindowsタスクスケジューラから削除するスクリプト
#>
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$TaskName = 'OUTDOOR_RACE_HUB_DailyGearSync_0700'
$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if (-not $Existing) {
    Write-Host "タスク「$TaskName」は現在登録されていません。" -ForegroundColor Yellow
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "タスク「$TaskName」を正常に削除しました。" -ForegroundColor Green
