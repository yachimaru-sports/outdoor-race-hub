@echo off
chcp 65001 > nul
title OUTDOOR RACE HUB - GitHub即時更新・本番デプロイ

echo ======================================================
echo   OUTDOOR RACE HUB - GitHub即時更新＆本番デプロイ
echo ======================================================
echo.

cd /d "D:\AI-System\ブログサイト"

echo [1/4] GitHubの最新コミットを確認・同期中...
git pull --rebase origin main
echo.

echo [2/4] Googleスプレッドシートから最新大会データを同期中...
node scripts/sync_from_sheets.mjs
echo.

echo [3/4] 大会データの重複チェックを実行中...
node scripts/audit-duplicates.mjs
if %errorlevel% neq 0 (
    echo.
    echo [警告] 重複データが検出されました。処理を中断します。
    pause
    exit /b %errorlevel%
)
echo.

echo [4/4] 変更内容をGitHubへプッシュ中...
git add src/data/events.json src/data/deals.json src/components/UpdateTicker.tsx
git diff --staged --quiet
if %errorlevel% neq 0 (
    git commit -m "chore(manual): デスクトップ手動バッチによる最新データ同期・本番反映"
    git push origin main
    echo.
    echo ✅ GitHubへのプッシュが完了しました！
) else (
    echo.
    echo ℹ️ 新規の変更データはありません（最新の状態です）。
)

echo.
echo ======================================================
echo   🎉 すべての処理が完了しました！
echo   本番サイトへの反映は約1〜2分で完了します。
echo   公開URL: https://yachimaru-sports.github.io/outdoor-race-hub/
echo ======================================================
echo.
pause
