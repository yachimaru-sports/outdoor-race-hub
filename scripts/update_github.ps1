[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  OUTDOOR RACE HUB - 完全自己修復＆最新データ同期バッチ' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''

Set-Location -Path 'D:\AI-System\ブログサイト'

if (-not (Test-Path '.git')) {
    Write-Host '[エラー] プロジェクトフォルダが見つかりません: D:\AI-System\ブログサイト' -ForegroundColor Red
    exit 1
}

Write-Host '[1/6] GitHubの最新コミットを確認・同期中...' -ForegroundColor Yellow
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
Write-Host '  -> リポジトリ同期完了' -ForegroundColor Green
Write-Host ''

Write-Host '[2/6] 装備カタログ更新＆自己修復中（商品ページ実測・画像/価格/割引率確定）...' -ForegroundColor Yellow
node scripts/refresh_gears.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host '[警告] 装備カタログの更新中にエラーが発生しました。' -ForegroundColor Red
} else {
    Write-Host '  -> 装備カタログ実測＆自己修復完了' -ForegroundColor Green
}
Write-Host ''

Write-Host '[3/6] 大会マスター更新＆正規化中...' -ForegroundColor Yellow
py scripts/sync_hub.py
Write-Host '  -> 大会マスター正規化完了' -ForegroundColor Green
Write-Host ''

Write-Host '[4/6] 大会リンクの自動修復中（Gemini AI探索）...' -ForegroundColor Yellow
node scripts/auto_heal_event_links.mjs
Write-Host '  -> 大会リンク検査＆修復完了' -ForegroundColor Green
Write-Host ''

Write-Host '[5/6] 公開前ゲート＆自己修復最終検証を実行中...' -ForegroundColor Yellow
node scripts/audit-duplicates.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host '[エラー] 大会データに重複が検出されました。処理を中断します。' -ForegroundColor Red
    exit 1
}
node scripts/validate_site_data.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host '[エラー] 公開前検証に不合格でした。前日の健全な状態を維持するため中断します。' -ForegroundColor Red
    exit 1
}
Write-Host '  -> 公開前ゲート合格（全品画像・リンク・割引率正常）' -ForegroundColor Green
Write-Host ''

Write-Host '[6/6] 本番ビルド＆GitHubへプッシュ中...' -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host '[エラー] ビルドに失敗しました。' -ForegroundColor Red
    exit 1
}

git add src/data/events.json src/data/deals.json src/data/gears.json src/data/meta.json
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m 'chore(manual): デスクトップ手動バッチによる最新データ自己修復・同期・本番反映'
    git push origin main
    Write-Host ''
    Write-Host '✅ GitHubへのプッシュが完了しました！' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host 'ℹ️ 既存データに変更はありません（すでに最新・健全な状態です）。' -ForegroundColor Green
}

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  🎉 すべての処理が正常に完了しました！' -ForegroundColor Green
Write-Host '  本番サイトへの反映は約1〜2分で完了します。' -ForegroundColor Gray
Write-Host '  公開URL: https://yachimaru-sports.github.io/outdoor-race-hub/' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''
