@echo off
setlocal
cd /d "%~dp0"
title Hearthbound
where node >nul 2>nul
if errorlevel 1 (
  echo Hearthbound needs Node.js 24 or newer.
  echo Download the Windows installer from https://nodejs.org/en/download
  echo Install Node.js, then double-click this file again.
  pause
  exit /b 1
)
node "%~dp0scripts\windows\start.mjs" %*
if errorlevel 1 (
  echo.
  echo Hearthbound could not start. Read the message above for details.
  pause
  exit /b 1
)
endlocal
