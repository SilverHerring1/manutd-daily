@echo off
rem 双击这个文件就能看日报：起一个本地预览服务器（禁用缓存），再打开浏览器。
rem 关掉这个黑色窗口 = 关掉服务器。
chcp 65001 >nul
cd /d "%~dp0"

start "" cmd /c "ping -n 2 127.0.0.1 >nul & start "" http://127.0.0.1:8131/"

where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py
) else (
  py serve.py
)
pause
