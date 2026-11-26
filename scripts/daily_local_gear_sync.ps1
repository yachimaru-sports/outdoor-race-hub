<#
.SYNOPSIS
    OUTDOOR RACE HUB 毎朝7:00 自動実測更新スクリプト（日本IP用）
.DESCRIPTION
    毎朝7:00にWindowsタスクスケジューラから非表示（バックグラウンド）で呼び出され、
    日本国内IPから全商品の在庫・実売価格・公式定価・リンク・画像を100%実測し、
    公開前検証とビルドに合格した場合のみ GitHub（main）へ自動反映します。
#>
param(
    [switch]$DryRun
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectDir 'logs'
$TodayStr = (Get-Date).ToString('yyyy-MM-dd')
$LogFile = Join-Path $LogDir "daily_sync_$TodayStr.log"
$StatusFile = Join-Path $LogDir 'last_run_status.txt'
$LockFile = Join-Path $LogDir 'daily_local_gear_sync.lock'
$DataFiles = @(
    'src/data/gears.json',
    'src/data/deals.json',
    'src/data/meta.json',
    'src/data/changelog.json'
)

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $line = "[$ts][$Level] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Save-RunStatus {
    param([string]$Result, [string]$Summary)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $content = @(
        "最終実行日時: $ts",
        "実行モード: $(if ($DryRun) { 'テスト実行（DryRun）' } else { '本番自動実行（毎朝7:00）' })",
        "実行結果: $Result",
        "概要: $Summary",
        "詳細ログ: $LogFile"
    ) -join "`r`n"
    Set-Content -Path $StatusFile -Value $content -Encoding UTF8
}

function Restore-DataFiles {
    Write-Log '安全のため更新途中のデータファイルを元の正常状態へ戻します。' 'WARN'
    & git checkout -- @DataFiles 2>&1 | ForEach-Object { Write-Log "$_" 'GIT' }
}

function Invoke-LoggedCommand {
    param([string]$Title, [scriptblock]$Command)
    Write-Log "▶ 開始: $Title"
    & $Command 2>&1 | ForEach-Object {
        $txt = "$_"
        if ($txt.Trim() -ne '') {
            Add-Content -Path $LogFile -Value $txt -Encoding UTF8
        }
    }
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Log "✖ 失敗（終了コード: $code）: $Title" 'ERROR'
        return $false
    }
    Write-Log "✔ 完了: $Title"
    return $true
}

# 14日より古い日次ログを自動整理
Get-ChildItem -Path $LogDir -Filter 'daily_sync_*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

Write-Log '================================================================'
Write-Log "OUTDOOR RACE HUB 毎朝7時自動更新 開始 (DryRun=$DryRun)"
Write-Log '================================================================'

Set-Location -Path $ProjectDir

# 二重起動防止ロック（2時間以上経過したロックは異常終了残骸として解除）
if (Test-Path $LockFile) {
    $lockInfo = Get-Item $LockFile
    if ($lockInfo.LastWriteTime -gt (Get-Date).AddHours(-2)) {
        $msg = '別プロセスが実行中のため今回の起動をスキップしました。'
        Write-Log $msg 'WARN'
        Save-RunStatus -Result 'スキップ' -Summary $msg
        exit 0
    }
    Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue
}

try {
    Set-Content -Path $LockFile -Value (Get-Date).ToString('o') -Encoding UTF8

    # タスクスケジューラ環境向け PATH 補完（Node.js / Git）
    foreach ($extraPath in @('C:\Program Files\nodejs', 'C:\Program Files\Git\cmd')) {
        if ((Test-Path $extraPath) -and ($env:PATH -notlike "*$extraPath*")) {
            $env:PATH = "$extraPath;$env:PATH"
        }
    }

    # .env 読み込み（存在する場合のみ）
    $envFile = Join-Path $ProjectDir '.env'
    if (Test-Path $envFile) {
        Get-Content $envFile -Encoding UTF8 | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
                $k, $v = $line.Split('=', 2)
                [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim().Trim('"').Trim("'"), 'Process')
            }
        }
        Write-Log '.env から環境変数を読み込みました。'
    }

    # 必須コマンド確認
    foreach ($cmd in @('node', 'git', 'npm')) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            $msg = "必須コマンドが見つかりません: $cmd"
            Write-Log $msg 'ERROR'
            Save-RunStatus -Result '失敗' -Summary $msg
            exit 1
        }
    }

    # ネットワーク疎通待機（PC起動直後・Wi-Fi接続待ち対策：最大60秒）
    $netOk = $false
    for ($i = 1; $i -le 6; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri 'https://github.com' -Method Head -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                $netOk = $true
                break
            }
        } catch {
            Write-Log "ネットワーク疎通待機中（${i}/6回目）..." 'WARN'
            Start-Sleep -Seconds 10
        }
    }
    if (-not $netOk) {
        $msg = 'インターネット（GitHub）に接続できないため中断しました。'
        Write-Log $msg 'ERROR'
        Save-RunStatus -Result '失敗（ネット未接続）' -Summary $msg
        exit 1
    }
    Write-Log 'ネットワーク疎通確認完了（GitHub接続OK）'

    # テスト実行モード（データ改変・プッシュは行わず環境確認のみ実施）
    if ($DryRun) {
        $nodeVer = (& node -v) -join ''
        $gitVer = (& git --version) -join ''
        $gitStat = (& git status --short) -join '; '
        if (-not $gitStat) { $gitStat = '作業ツリークリーン' }
        $msg = "テスト実行成功（Node: $nodeVer / $gitVer / Git状態: $gitStat）"
        Write-Log $msg
        Save-RunStatus -Result 'テスト成功（DryRun）' -Summary $msg
        exit 0
    }

    # 最新リポジトリ同期（朝6時のGitHub Actionsによる大会・背景更新を取り込む）
    $stashed = $false
    $dirtyTrack = & git status --porcelain --untracked-files=no
    if ($dirtyTrack) {
        Write-Log 'ローカル変更を一時退避（stash）して最新リポジトリを取り込みます。'
        & git stash push -m 'daily_local_gear_sync_autostash' 2>&1 | Out-Null
        $stashed = $true
    }
    & git pull --rebase origin main 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value "$_" -Encoding UTF8 }
    if ($LASTEXITCODE -ne 0) {
        & git rebase --abort 2>$null
        if ($stashed) { & git stash pop 2>$null }
        $msg = 'GitHubからの最新データ取り込み（git pull --rebase）に失敗しました。'
        Write-Log $msg 'ERROR'
        Save-RunStatus -Result '失敗（Git同期エラー）' -Summary $msg
        exit 1
    }
    if ($stashed) {
        & git stash pop 2>$null
    }
    Write-Log '最新リポジトリ（origin/main）の取り込み完了'

    # Step 1: 全商品100%実測更新
    if (-not (Invoke-LoggedCommand -Title 'Step 1: 商品データ実測更新 (refresh_gears.mjs)' -Command { node scripts/refresh_gears.mjs })) {
        Restore-DataFiles
        Save-RunStatus -Result '失敗（Step 1）' -Summary '商品実測更新に失敗したため、前日の正常データを維持しました。'
        exit 1
    }

    # Step 2: 公開前最終ゲート検証
    if (-not (Invoke-LoggedCommand -Title 'Step 2: 公開前最終ゲート検証 (validate_site_data.mjs)' -Command { node scripts/validate_site_data.mjs })) {
        Restore-DataFiles
        Save-RunStatus -Result '失敗（Step 2）' -Summary '公開前最終ゲートに不合格のため、前日の正常データを維持しました。'
        exit 1
    }

    # Step 3: 公開前事前監査＆ビルド検証
    if (-not (Invoke-LoggedCommand -Title 'Step 3: 事前監査＆本番ビルド検証 (npm run build)' -Command { npm run build })) {
        Restore-DataFiles
        Save-RunStatus -Result '失敗（Step 3）' -Summary '事前監査または本番ビルドに失敗したため、公開を中断しました。'
        exit 1
    }

    # Step 4: データ4ファイルのみ明示的にコミット＆プッシュ
    & git add -- @DataFiles
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        $msg = '全商品の実測検証を完了しました（データ差分なしのためプッシュ不要）。'
        Write-Log $msg
        Save-RunStatus -Result '成功（変更なし）' -Summary $msg
        exit 0
    }

    $commitMsg = 'chore(auto-local): 毎朝7時日本IP実測同期（全品在庫・実売価格・リンク検証＆特価入替済み）'
    if (-not (Invoke-LoggedCommand -Title 'Step 4-1: 検証済みデータのコミット' -Command { git commit -m $commitMsg })) {
        Save-RunStatus -Result '失敗（コミット）' -Summary 'Gitコミットに失敗しました。'
        exit 1
    }

    $pushed = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        & git push origin main 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value "$_" -Encoding UTF8 }
        if ($LASTEXITCODE -eq 0) {
            $pushed = $true
            break
        }
        Write-Log "プッシュ失敗（${attempt}/3回目）。10秒後に最新mainを取り込み直して再試行します。" 'WARN'
        Start-Sleep -Seconds 10
        & git pull --rebase --autostash origin main 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value "$_" -Encoding UTF8 }
        if ($LASTEXITCODE -ne 0) {
            & git rebase --abort 2>$null
        }
    }

    if (-not $pushed) {
        $msg = 'GitHubへのプッシュが3回連続で失敗しました。'
        Write-Log $msg 'ERROR'
        Save-RunStatus -Result '失敗（プッシュ）' -Summary $msg
        exit 1
    }

    $okMsg = '毎朝7時の日本IP全品実測更新・検証・GitHub反映が正常に完了しました。'
    Write-Log $okMsg
    Save-RunStatus -Result '成功（本番反映完了）' -Summary $okMsg
    exit 0
}
finally {
    if (Test-Path $LockFile) {
        Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue
    }
    Write-Log '処理終了'
}
