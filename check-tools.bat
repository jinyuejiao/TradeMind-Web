@echo off

cls
echo ==========================================
echo Web服务器工具检查
echo ==========================================
echo.

rem 检查Node.js
echo 1. 检查Node.js:
echo -------------------
node --version 2>NUL
if %ERRORLEVEL% equ 0 (
    echo Node.js 已安装
    npm --version 2>NUL
    if %ERRORLEVEL% equ 0 (
        echo npm 已安装
        npm list -g http-server 2>NUL
        if %ERRORLEVEL% equ 0 (
            echo http-server 已安装
        ) else (
            echo http-server 未安装
        )
    ) else (
        echo npm 未安装
    )
) else (
    echo Node.js 未安装
)
echo.

rem 检查Python
echo 2. 检查Python:
echo -------------------
python --version 2>NUL
if %ERRORLEVEL% equ 0 (
    echo Python 已安装
) else (
    echo Python 未安装
    python3 --version 2>NUL
    if %ERRORLEVEL% equ 0 (
        echo Python 3 已安装
    ) else (
        echo Python 3 未安装
    )
)
echo.

rem 检查IIS Express
echo 3. 检查IIS Express:
echo -------------------
where iisexpress 2>NUL
if %ERRORLEVEL% equ 0 (
    echo IIS Express 已安装
) else (
    echo IIS Express 未安装
)
echo.

rem 检查PowerShell
echo 4. 检查PowerShell:
echo -------------------
powershell -Command $PSVersionTable.PSVersion 2>NUL
if %ERRORLEVEL% equ 0 (
    echo PowerShell 已安装
) else (
    echo PowerShell 未安装
)
echo.
echo ==========================================
echo 检查完成
echo ==========================================

pause