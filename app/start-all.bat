@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
call npm run install:all
echo.
echo Starting frontend + backend...
call npm run dev
