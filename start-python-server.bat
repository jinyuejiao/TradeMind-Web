@echo off

rem Python HTTP Server Starter for TradeMind Web
rem Uses port 8000 and includes detailed error handling

set PORT=8000
set BASE_DIR=%~dp0

cls
echo ==========================================
echo TradeMind Web Server (Python)
echo Port: %PORT%
echo Base Directory: %BASE_DIR%
echo ==========================================
echo.
echo Checking Python installation...
echo.

rem Test Python availability
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Python found!
echo.
echo Starting Python HTTP server...
echo Access URL: http://localhost:%PORT%/
echo Login Page: http://localhost:%PORT%/login.html
echo Index Page: http://localhost:%PORT%/index.html
echo Press Ctrl+C to stop the server
echo.

rem Change to the directory where this batch file is located
cd /d %BASE_DIR%

rem Start Python HTTP server
echo Starting server...
python -m http.server %PORT%

) else (
    echo ❌ Python not found!
echo.
echo Please install Python from https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH" during installation
echo.
pause
)

echo.
echo ==========================================
echo Server stopped
echo ==========================================
echo.
pause
