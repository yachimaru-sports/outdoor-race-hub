@echo off
title OUTDOOR RACE HUB
echo ========================================================
echo   OUTDOOR RACE HUB を起動しています...
echo   ブラウザが自動的に開くまで数秒お待ちください...
echo ========================================================
echo.
cd /d "d:\AI-System\ブログサイト"
start "" cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:5173/"
echo.
echo ※この画面を閉じるとサイトも停止します。開いたままご利用ください。
echo.
npm run dev
pause