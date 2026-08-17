@echo off
title Alma y Vinilo Studio 2
setlocal
netstat -an | findstr /C:":3051" | findstr /C:"LISTENING" >nul 2>&1
if errorlevel 1 (
  start "" /min node "%~dp0server.js"
  ping 127.0.0.1 -n 3 >nul
)
start "" "http://localhost:3051"
endlocal
