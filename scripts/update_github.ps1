[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  OUTDOOR RACE HUB - GitHub即時更新＆本番デプロイ" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path "D:\AI-System\ブログサイト"

if (-not (Test-Path ".git")) {
    Write-Host "[エラー] プロジェクトフォルダが見つかりません。" -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] GitHubの最新コミットを確認・同期中..." -ForegroundColor Yellow
$status = git status --porcelain
$stashed = $false
if ($status) {
    git stash --include-untracked > $null 2>&1
    $stashed = $true
}
git pull --rebase origin main
if ($stashed) {
    git stash pop > $null 2>&1
}
Write-Host ""

Write-Host "[2/4] Googleスプレッドシートから最新大会データを直接同期中..." -ForegroundColor Yellow
node scripts/sync_from_sheets.mjs
node scripts/sync_gears.mjs
Write-Host ""

Write-Host "[3/4] 大会データの重複チェックを実行中..." -ForegroundColor Yellow
node scripts/audit-duplicates.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[警告] 重複データが検出されました。処理を中断します。" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "[4/4] 変更内容をGitHubへプッシュ中..." -ForegroundColor Yellow
git add src/data/events.json src/data/deals.json src/data/gears.json src/components/UpdateTicker.tsx
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "chore(manual): デスクトップ手動バッチによる最新データ同期・本番反映"
    git push origin main
    Write-Host ""
    Write-Host "✅ GitHubへのプッシュが完了しました！" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ℹ️ 新規の変更データはありません（最新の状態です）。" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  🎉 すべての処理が正常に完了しました！" -ForegroundColor Green
Write-Host "  本番サイトへの反映は約1〜2分で完了します。" -ForegroundColor Gray
Write-Host "  公開URL: https://yachimaru-sports.github.io/outdoor-race-hub/" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
