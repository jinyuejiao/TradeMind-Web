# Start Python HTTP Server
# This script starts a simple HTTP server using Python

$ErrorActionPreference = "Continue"

# Configuration
$Port = 9013
$BaseDir = "d:\项目\TradeMind\项目工程\TM_Project\trademind-web"

Write-Host "=========================================="
Write-Host "TradeMind Web Server (Python)"
Write-Host "Port: $Port"
Write-Host "Base Directory: $BaseDir"
Write-Host "=========================================="

# Change to base directory
cd $BaseDir

# Start Python HTTP server
try {
    Write-Host "Starting Python HTTP server..."
    Write-Host "Access URL: http://localhost:$Port/"
    Write-Host "Login Page: http://localhost:$Port/login.html"
    Write-Host "Index Page: http://localhost:$Port/index.html"
    Write-Host "Press Ctrl+C to stop the server"
    Write-Host ""
    
    # Start Python server
    python -m http.server $Port
} catch {
    Write-Host "Error starting server: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host "Server stopped"
}