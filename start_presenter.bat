@echo off
echo Starting VietLMS Presenter...
:: Clear any Node environment variables that might interfere
set ELECTRON_RUN_AS_NODE=
set NODE_OPTIONS=

cd /d "%~dp0"

:: 1. Force Clean Build Artifacts & Caches
echo Cleaning caches...
if exist "dist" rmdir /s /q "dist"
if exist "dist-electron" rmdir /s /q "dist-electron"
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"

:: 2. Compile Backend (Electron Main)
echo Compiling Electron Main...
call npx tsc -p tsconfig.electron.json

:: 3. Serve Frontend & Launch Electron
echo Launching...
call npm run electron:dev

if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo ERROR: The application failed to start.
    echo.
    pause
)
