@echo off
chcp 65001 >nul
title 宠物寄养与美容店管理系统 - 停止

echo.
echo 🛑 正在停止所有服务...
echo.

cd /d "%~dp0"
node scripts\stop.js

echo.
pause
