@echo off
chcp 65001 >nul
title 宠物寄养与美容店管理系统 - 启动器

echo.
echo ╔════════════════════════════════════════════════╗
echo ║                                                ║
echo ║    🐾 宠物寄养与美容店管理系统 🐾             ║
echo ║                                                ║
echo ╚════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

if not exist "backend\node_modules" (
    echo 📦 正在安装后端依赖...
    cd backend
    call npm install
    cd ..
    echo.
)

if not exist "frontend\node_modules" (
    echo 📦 正在安装前端依赖...
    cd frontend
    call npm install
    cd ..
    echo.
)

echo 🚀 正在启动所有服务...
node scripts\start.js

pause
