@echo off

rem Comprehensive Web Server Starter for TradeMind Web
rem Uses port 8000 and includes error handling

set PORT=8000
set BASE_DIR=%~dp0

cls
echo ==========================================
echo TradeMind Web Server Starter
echo Port: %PORT%
echo Base Directory: %BASE_DIR%
echo ==========================================
echo.

rem Check if Python is available
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python found! Using Python http.server
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
python -m http.server %PORT%

) else (
    echo Python not found! Trying PowerShell HttpListener...
echo.

rem Start PowerShell server
powershell -ExecutionPolicy Bypass -Command "&
$Port = 8000;
$BaseDir = '%BASE_DIR%';
Write-Host '==========================================';
Write-Host 'TradeMind Web Server (PowerShell)';
Write-Host 'Port: $Port';
Write-Host 'Base Directory: $BaseDir';
Write-Host '==========================================';
Write-Host 'Server starting...';
Write-Host 'Access URL: http://localhost:$Port/';
Write-Host 'Login Page: http://localhost:$Port/login.html';
Write-Host 'Index Page: http://localhost:$Port/index.html';
Write-Host 'Press Ctrl+C to stop the server';
Write-Host '';

$listener = New-Object System.Net.HttpListener;
$listener.Prefixes.Add('http://localhost:$Port/');

try {
    $listener.Start();
    Write-Host 'Server started successfully!';
    
    while ($listener.IsListening) {
        $context = $listener.GetContext();
        $request = $context.Request;
        $response = $context.Response;
        $url = $request.Url.LocalPath;
        
        Write-Host "$($request.HttpMethod) $url";
        
        if ($url -eq '/') {
            $filePath = Join-Path $BaseDir 'index.html';
        } else {
            $localPath = $url.TrimStart('/');
            $filePath = Join-Path $BaseDir $localPath;
        }
        
        if (Test-Path $filePath -PathType Leaf) {
            try {
                $content = [System.IO.File]::ReadAllBytes($filePath);
                
                $extension = [System.IO.Path]::GetExtension($filePath).ToLower();
                $contentType = 'application/octet-stream';
                
                switch ($extension) {
                    '.html' { $contentType = 'text/html; charset=utf-8' }
                    '.htm' { $contentType = 'text/html; charset=utf-8' }
                    '.css' { $contentType = 'text/css' }
                    '.js' { $contentType = 'application/javascript' }
                    '.png' { $contentType = 'image/png' }
                    '.jpg' { $contentType = 'image/jpeg' }
                    '.jpeg' { $contentType = 'image/jpeg' }
                    '.gif' { $contentType = 'image/gif' }
                    '.json' { $contentType = 'application/json' }
                    '.txt' { $contentType = 'text/plain' }
                }
                
                $response.ContentType = $contentType;
                $response.ContentLength64 = $content.Length;
                $response.OutputStream.Write($content, 0, $content.Length);
                
                Write-Host '  Status: 200 OK';
            } catch {
                Write-Host '  Status: 500 Internal Server Error';
                Write-Host '  Error: $($_.Exception.Message)';
                
                $errorContent = [System.Text.Encoding]::UTF8.GetBytes('Internal Server Error');
                $response.StatusCode = 500;
                $response.ContentLength64 = $errorContent.Length;
                $response.OutputStream.Write($errorContent, 0, $errorContent.Length);
            }
        } else {
            Write-Host '  Status: 404 Not Found';
            Write-Host '  File: $filePath';
            
            $errorContent = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found');
            $response.StatusCode = 404;
            $response.ContentLength64 = $errorContent.Length;
            $response.OutputStream.Write($errorContent, 0, $errorContent.Length);
        }
        
        $response.Close();
    }
} catch {
    Write-Host 'Error starting server: $($_.Exception.Message)' -ForegroundColor Red;
} finally {
    if ($listener -ne $null) {
        $listener.Stop();
        $listener.Close();
    }
    Write-Host 'Server stopped';
}
"
)

echo.
echo ==========================================
echo Server stopped
echo ==========================================
echo.
pause
