@echo off

cls
echo ==========================================
echo TradeMind Web Server
echo ==========================================
echo Server starting...
echo.

rem 使用Windows内置的命令启动一个简单的HTTP服务器
rem 这种方法不需要依赖Python或PowerShell的复杂功能

rem 创建一个简单的HTML文件作为服务器入口
if not exist server-start.html (
    echo ^<!DOCTYPE html^> > server-start.html
    echo ^<html^> >> server-start.html
    echo ^<head^> >> server-start.html
    echo ^<title^>TradeMind Web Server^</title^> >> server-start.html
    echo ^<style^> >> server-start.html
    echo body { font-family: Arial, sans-serif; padding: 20px; } >> server-start.html
    echo h1 { color: #333; } >> server-start.html
    echo .section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; } >> server-start.html
    echo a { color: #007bff; text-decoration: none; } >> server-start.html
    echo a:hover { text-decoration: underline; } >> server-start.html
    echo ^</style^> >> server-start.html
    echo ^</head^> >> server-start.html
    echo ^<body^> >> server-start.html
    echo ^<h1^>TradeMind Web Server^</h1^> >> server-start.html
    echo ^<div class="section"^> >> server-start.html
    echo ^<h2^>可用页面^</h2^> >> server-start.html
    echo ^<ul^> >> server-start.html
    echo ^<li^>^<a href="login.html"^>登录页面^</a^>^</li^> >> server-start.html
    echo ^<li^>^<a href="register.html"^>注册页面^</a^>^</li^> >> server-start.html
    echo ^<li^>^<a href="index.html"^>主页面/工作台^</a^>^</li^> >> server-start.html
    echo ^<li^>^<a href="customer-manage.html"^>客户CRM^</a^>^</li^> >> server-start.html
    echo ^<li^>^<a href="production.html"^>产研中心^</a^>^</li^> >> server-start.html
    echo ^<li^>^<a href="supplier.html"^>供应链管理^</a^>^</li^> >> server-start.html
    echo ^</ul^> >> server-start.html
    echo ^</div^> >> server-start.html
    echo ^</body^> >> server-start.html
    echo ^</html^> >> server-start.html
)

echo 服务器入口文件已创建: server-start.html
echo.

rem 尝试使用不同的方法启动服务器
echo 尝试方法 1: 使用Windows资源管理器打开服务器入口
echo ---------------------------------------------------
echo 请在文件资源管理器中找到并双击打开以下文件:
echo %~dp0server-start.html
echo.

echo 尝试方法 2: 使用默认浏览器打开服务器入口
echo ---------------------------------------------------
echo 正在尝试打开浏览器...
start server-start.html
echo.

echo 尝试方法 3: 手动启动Python服务器
echo ---------------------------------------------------
echo 请打开一个新的命令提示符窗口，然后执行以下命令:
echo cd "%~dp0"
echo python -m http.server 8080
echo.
echo 然后在浏览器中访问: http://localhost:8080/
echo.
echo ==========================================
echo 服务器启动指南
echo ==========================================
echo 请尝试以上方法，找到最适合您环境的解决方案。
echo.
echo 如果所有方法都失败，您仍然可以直接在浏览器中打开HTML文件。
echo.
pause