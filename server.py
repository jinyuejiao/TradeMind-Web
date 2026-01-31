# Simple HTTP Server for TradeMind Web
import http.server
import socketserver
import os

PORT = 9013

# Change to the directory where this script is located
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Custom log format
        print(f"{self.client_address[0]} - [{self.log_date_time_string()}] {format % args}")

print("==========================================")
print("TradeMind Web Server (Python)")
print(f"Port: {PORT}")
print(f"Base Directory: {os.getcwd()}")
print("==========================================")
print(f"Server starting...")
print(f"Access URL: http://localhost:{PORT}/")
print(f"Login Page: http://localhost:{PORT}/login.html")
print(f"Index Page: http://localhost:{PORT}/index.html")
print("Press Ctrl+C to stop the server")
print("")

try:
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped by user")
except Exception as e:
    print(f"Error starting server: {e}")
finally:
    print("Server stopped")