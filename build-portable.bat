@echo off
setlocal

cd /d "%~dp0"

set "PORTABLE_NODE_DIR="
for /d %%D in (".tools\node-v22*-win-x64") do set "PORTABLE_NODE_DIR=%%~fD"

if not defined PORTABLE_NODE_DIR (
  echo Portable Node.js was not found in .tools.
  echo Download the Node.js 22 LTS Windows x64 ZIP and extract it under .tools.
  pause
  exit /b 1
)

if not exist "%PORTABLE_NODE_DIR%\node.exe" (
  echo node.exe was not found in "%PORTABLE_NODE_DIR%".
  pause
  exit /b 1
)

set "PATH=%PORTABLE_NODE_DIR%;%PATH%"

echo Building portable EXE...
call "%PORTABLE_NODE_DIR%\npm.cmd" run desktop:build

if errorlevel 1 (
  echo.
  echo Portable EXE build failed.
  pause
  exit /b 1
)

echo.
echo Portable EXE created in the release folder.
pause
