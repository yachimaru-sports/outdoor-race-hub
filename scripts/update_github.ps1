[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# =====================================================================
#  OUTDOOR RACE HUB - 手動更新バッチ
#  GitHub Actions の毎朝8時自動更新（.github/workflows/daily_sync.yml）と
#  まったく同じ手順を、このPC上で実行して GitHub へプッシュします。
#  ※ daily_sync.yml を変更したら、このファイルも同じ内容に合わせてください。
# =====================================================================

$ProjectDir = 'D:\AI-System\ブログサイト'
$DataFiles = @(
    'src/data/events.json',
    'src/data/events_archive.json',
    'src/data/deals.json',
    'src/data/gears.json',
    'src/data/meta.json',
    'src/data/changelog.json'
)
$Failed = @()

function Write-Step($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Ok($msg)   { Write-Host "  -> $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [警告] $msg" -ForegroundColor Red }
function Stop-Batch($msg) {
    Write-Host ''
    Write-Host "[エラー] $msg" -ForegroundColor Red
    Write-Host '公開前の安全確認に不合格のため、プッシュせずに中断しました（サイトは前回の正常な状態のままです）。' -ForegroundColor Red
    exit 1
}

Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  OUTDOOR RACE HUB - 手動更新（毎朝8時の自動更新と同じ処理）' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''

Set-Location -Path $ProjectDir
if (-not (Test-Path '.git')) { Stop-Batch "プロジェクトフォルダが見つかりません: $ProjectDir" }

# ---------------------------------------------------------------------
# APIキーの読み込み（GitHub の Secrets に相当）
#   プロジェクト直下の .env（Git管理外）に「キー名=値」で書いておくと読み込みます。
#   例: RAKUTEN_APP_ID=xxxx
# ---------------------------------------------------------------------
if (Test-Path '.env') {
    Get-Content '.env' -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $k, $v = $line.Split('=', 2)
            [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim().Trim('"').Trim("'"), 'Process')
        }
    }
}
$missing = @('RAKUTEN_APP_ID', 'RAKUTEN_ACCESS_KEY', 'RAKUTEN_AFFILIATE_ID', 'GEMINI_API_KEY', 'GCP_SA_KEY') |
    Where-Object { -not [Environment]::GetEnvironmentVariable($_) }
if ($missing) {
    Write-Warn ("次のAPIキーが未設定です: " + ($missing -join ', '))
    Write-Host '         該当する処理は失敗し、その部分は前日の正常データのまま公開されます。' -ForegroundColor Red
    Write-Host '         設定するには、プロジェクト直下の .env に「キー名=値」で書いてください。' -ForegroundColor Red
    Write-Host ''
}

# Python コマンドの決定（py → python の順）
$Py = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }

# ---------------------------------------------------------------------
Write-Step '[準備] GitHub の最新状態を取り込み中...'
$stashed = $false
if (git status --porcelain) {
    git stash --include-untracked | Out-Null
    $stashed = $true
}
git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
    git rebase --abort 2>$null
    if ($stashed) { git stash pop | Out-Null }
    Stop-Batch 'GitHub からの取り込みに失敗しました。'
}
if ($stashed) { git stash pop | Out-Null }
Write-Ok 'リポジトリ同期完了'

Write-Step '[準備] 依存パッケージを確認中...'
& $Py -m pip install -q -r requirements.txt
npm ci --silent
if ($LASTEXITCODE -ne 0) { Stop-Batch 'npm ci に失敗しました。' }
Write-Ok '依存パッケージ準備完了'
Write-Host ''

# ---------------------------------------------------------------------
Write-Step '[Step 1/6] 装備カタログ・お得情報更新（商品ページ実測・新規特価探索＆入替）...'
node scripts/refresh_gears.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Warn '装備更新に失敗したため、前日の正常データに戻します。'
    git checkout -- src/data/gears.json src/data/deals.json src/data/meta.json
    $Failed += 'Step 1 装備カタログ更新'
} else { Write-Ok '装備カタログ更新完了' }
Write-Host ''

Write-Step '[Step 2/6] 大会データ自動更新（終了アーカイブ・次回調査・新着大会追加・リンク照合＆修復）...'
node scripts/update_events.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Warn '大会更新に失敗したため、前日の正常データに戻します。'
    git checkout -- src/data/events.json src/data/events_archive.json src/data/changelog.json
    $Failed += 'Step 2 大会データ更新'
} else { Write-Ok '大会データ更新完了' }
Write-Host ''

Write-Step '[Step 3/6] Googleスプレッドシート＆マスターCSV同期（失敗してもサイト更新は継続）...'
& $Py scripts/sync_hub.py
if ($LASTEXITCODE -ne 0) {
    Write-Warn 'スプレッドシート同期に失敗しました（サイト更新は継続します）。'
    $Failed += 'Step 3 スプレッドシート同期'
} else { Write-Ok 'スプレッドシート同期完了' }
Write-Host ''

Write-Step '[Step 4/6] 公開前ゲート＆自己修復（重複ゼロ・装備の全リンク/画像/割引率の検証）...'
npm run check:duplicates
if ($LASTEXITCODE -ne 0) { Stop-Batch '大会データに重複が検出されました。' }
node scripts/validate_site_data.mjs
if ($LASTEXITCODE -ne 0) { Stop-Batch '公開前検証に不合格でした。' }
Write-Ok '公開前ゲート合格'
Write-Host ''

Write-Step '[Step 5/6] ビルド（事前監査・型チェック・SEO静的ページ生成込み）...'
npm run build
if ($LASTEXITCODE -ne 0) { Stop-Batch 'ビルドに失敗しました。' }
Write-Ok 'ビルド完了'
Write-Host ''

Write-Step '[Step 6/6] 検証済みデータをコミット＆プッシュ...'
# Git管理下のデータファイルだけを追加（.gitignore 対象の CSV 等は含めない）
foreach ($f in $DataFiles) {
    if (Test-Path $f) {
        git check-ignore -q $f
        if ($LASTEXITCODE -ne 0) { git add -- $f }
    }
}
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Ok 'データ変更なし（すでに最新のためプッシュは不要です）'
} else {
    git commit -m 'chore(manual): 手動バッチによる定期同期（毎朝8時の自動更新と同一処理）' | Out-Null
    $pushed = $false
    foreach ($i in 1..3) {
        git pull --rebase --autostash origin main
        if ($LASTEXITCODE -eq 0) {
            git push origin main
            if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
        } else {
            git rebase --abort 2>$null
        }
        Write-Warn "プッシュ失敗（${i}回目）。10秒後に再試行します。"
        Start-Sleep -Seconds 10
    }
    if ($pushed) {
        Write-Ok 'GitHub へのプッシュ完了（約1〜2分で本番サイトに自動反映されます）'
    } else {
        $Failed += 'Step 6 プッシュ'
    }
}

# ---------------------------------------------------------------------
Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
if ($Failed.Count -eq 0) {
    Write-Host '  🎉 すべての処理が正常に完了しました！' -ForegroundColor Green
} else {
    Write-Host '  ⚠️ 一部の処理が失敗しました（成功した分は反映済みです）:' -ForegroundColor Red
    $Failed | ForEach-Object { Write-Host "    ・$_" -ForegroundColor Red }
}
Write-Host '  公開URL: https://yachimaru-sports.github.io/outdoor-race-hub/' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''
if ($Failed.Count -gt 0) { exit 1 }
