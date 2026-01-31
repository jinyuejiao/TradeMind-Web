# Simple HTTP Server for TradeMind Web
# Minimal static file server with no Chinese characters

$ErrorActionPreference = "Continue"

# Configuration
$Port = 9013
$BaseDir = "d:\项目\TradeMind\项目工程\TM_Project\TradeMind-Web"

Write-Host "=========================================="
Write-Host "TradeMind Web Server"
Write-Host "Port: $Port"
Write-Host "Base Directory: $BaseDir"
Write-Host "=========================================="

# Create HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

Try {
    # Start listener
    $listener.Start()
    Write-Host "Server started successfully!"
    Write-Host "Access URL: http://localhost:$Port/"
    Write-Host "Login Page: http://localhost:$Port/login.html"
    Write-Host "Index Page: http://localhost:$Port/index.html"
    Write-Host "Press Ctrl+C to stop the server"
    Write-Host ""
    
    # Main loop
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $url = $request.Url.LocalPath
        
        # Log request
        Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $($request.HttpMethod) $url"
        
        # Determine file path
        if ($url -eq "/") {
            $filePath = Join-Path $BaseDir "index.html"
        } else {
            $localPath = $url.TrimStart("/")
            $filePath = Join-Path $BaseDir $localPath
        }
        
        # Check if file exists
        if (Test-Path $filePath -PathType Leaf) {
            Try {
                # Read file content
                $content = [System.IO.File]::ReadAllBytes($filePath)
                
                # Set content type
                $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "application/octet-stream"
                
                switch ($extension) {
                    ".html" { $contentType = "text/html; charset=utf-8" }
                    ".htm" { $contentType = "text/html; charset=utf-8" }
                    ".css" { $contentType = "text/css" }
                    ".js" { $contentType = "application/javascript" }
                    ".png" { $contentType = "image/png" }
                    ".jpg" { $contentType = "image/jpeg" }
                    ".jpeg" { $contentType = "image/jpeg" }
                    ".gif" { $contentType = "image/gif" }
                    ".json" { $contentType = "application/json" }
                    ".txt" { $contentType = "text/plain" }
                }
                
                # Send response
                $response.ContentType = $contentType
                $response.ContentLength64 = $content.Length
                $response.OutputStream.Write($content, 0, $content.Length)
                
                Write-Host "  Status: 200 OK"
            } Catch {
                # Handle file read error
                Write-Host "  Status: 500 Internal Server Error"
                Write-Host "  Error: $($_.Exception.Message)"
                
                $errorContent = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
                $response.StatusCode = 500
                $response.ContentLength64 = $errorContent.Length
                $response.OutputStream.Write($errorContent, 0, $errorContent.Length)
            }
        } else {
            # File not found
            Write-Host "  Status: 404 Not Found"
            Write-Host "  File: $filePath"
            
            $errorContent = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.StatusCode = 404
            $response.ContentLength64 = $errorContent.Length
            $response.OutputStream.Write($errorContent, 0, $errorContent.Length)
        }
        
        # Close response
        $response.Close()
    }
} Catch {
    # Handle listener error
    Write-Host "Error starting server: $($_.Exception.Message)" -ForegroundColor Red
} Finally {
    # Cleanup
    if ($listener -ne $null) {
        $listener.Stop()
        $listener.Close()
    }
    Write-Host "Server stopped"
}
