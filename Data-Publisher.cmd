@echo off
where pwsh >nul 2>nul
if errorlevel 1 (
  echo PowerShell 7 is required. Install it, then run this launcher again.
  pause
  exit /b 1
)
pwsh -NoLogo -NoProfile -STA -WindowStyle Hidden -File "%~dp0tools\data-publisher.ps1"
