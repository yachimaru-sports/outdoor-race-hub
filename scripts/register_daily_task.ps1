<#
.SYNOPSIS
    毎朝7:00自動実行タスクをWindowsタスクスケジューラへ登録するスクリプト
.DESCRIPTION
    タスク名「OUTDOOR_RACE_HUB_DailyGearSync_0700」として、
    毎朝7:00に非表示ウィンドウで日本IP実測更新を実行するよう登録します。
#>
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$TaskName = 'OUTDOOR_RACE_HUB_DailyGearSync_0700'
$ScriptPath = Join-Path $PSScriptRoot 'daily_local_gear_sync.ps1'

if (-not (Test-Path $ScriptPath)) {
    Write-Error "対象スクリプトが見つかりません: $ScriptPath"
    exit 1
}

# PowerShell 7（pwsh.exe）を優先使用（UTF-8完全対応）。なければWindows PowerShellを使用
$PwshCmd = Get-Command 'pwsh.exe' -ErrorAction SilentlyContinue
$ExePath = if ($PwshCmd) { $PwshCmd.Source } else { (Get-Command 'powershell.exe').Source }

# 日本語パスによる文字化けを完全に防ぐため UTF-16LE Base64 (-EncodedCommand) で呼び出す
$InnerCommand = "& '$ScriptPath'"
$EncodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($InnerCommand))
$Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $EncodedCommand"

$Action = New-ScheduledTaskAction -Execute $ExePath -Argument $Arguments
$Trigger = New-ScheduledTaskTrigger -Daily -At '07:00'
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description 'OUTDOOR RACE HUB 毎朝7:00 日本IPからの商品在庫・実売価格・リンク100%実測更新＆GitHub自動反映' `
    -Force | Out-Null

$Task = Get-ScheduledTask -TaskName $TaskName
$Info = Get-ScheduledTaskInfo -TaskName $TaskName

Write-Host '================================================================' -ForegroundColor Cyan
Write-Host '  Windows タスクスケジューラ 登録完了' -ForegroundColor Green
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host "タスク名       : $($Task.TaskName)"
Write-Host "状態           : $($Task.State)"
Write-Host "実行ユーザー   : $CurrentUser"
Write-Host "実行プログラム : $ExePath"
Write-Host "次回実行予定   : $($Info.NextRunTime)"
Write-Host "取りこぼし補完 : 7:00にPC未起動の場合も起動後に自動実行（StartWhenAvailable）"
Write-Host '================================================================' -ForegroundColor Cyan
