@echo off

rem Simple HTTP Server for TradeMind Web
rem This batch file starts a Python HTTP server

set PORT=8080
set BASE_DIR=%~dp0

cls
echo ==========================================
echo TradeMind Web Server
echo Port: %PORT%
echo Base Directory: %BASE_DIR%
echo ==========================================
echo Server starting...
echo Access URL: http://localhost:%PORT%/
echo Login Page: http://localhost:%PORT%/login.html
echo Index Page: http://localhost:%PORT%/index.html
echo Press Ctrl+C to stop the server
echo.

rem Change to the directory where this batch file is located
cd /d %BASE_DIR%

rem Start Python HTTP server
python -m http.server %PORT%

pause