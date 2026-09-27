@echo off
REM Bhasha Node — Desktop launcher trampoline
REM This .bat file exists so the desktop shortcut has a stable target.
REM It runs launch.ps1 in a visible, coloured PowerShell window.

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

start "Bhasha Node" powershell.exe ^
  -NoProfile ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0launch.ps1"
