REM ******************************************************************************
REM Crypgo Project - Development Environment Startup Script (Windows)
REM 
REM Features:
REM - Automatic database migrations
REM - Service health checking
REM - Recovery from crashes
REM - Console logging with colors
REM - Cross-platform compatible
REM ******************************************************************************

@echo off
setlocal enabledelayedexpansion

REM Configuration
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%~dp0..\"
set "LOG_DIR=%PROJECT_ROOT%logs"

REM Service ports
set "FRONTEND_PORT=5000"
set "CRYPTOGO_PORT=8000"
set "BOT_PORT=8001"

REM Service URLs
set "CRYPTOGO_URL=http://127.0.0.1:%CRYPTOGO_PORT%"
set "CRYPTOGO_HEALTH_URL=%CRYPTOGO_URL%/health/"
set "BOT_URL=http://127.0.0.1:%BOT_PORT%"
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%"

REM Create logs directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Logging function
call :Log INFO "============================================================="
call :Log INFO "           Crypgo Development Environment Startup"
call :Log INFO "============================================================="
call :Log INFO "Project root: %PROJECT_ROOT%"
call :Log INFO "Log directory: %LOG_DIR%"
call :Log INFO ""

REM Check if services already running
call :CheckPortOpen %CRYPTOGO_PORT% skip_crypgo "Crypgo backend"
call :CheckPortOpen %BOT_PORT% skip_bot "Bot backend"
call :CheckPortOpen %FRONTEND_PORT% skip_frontend "Frontend"

if !skip_crypgo! equ 0 (
    call :Log INFO "Starting Crypgo Django backend..."
    set "DJANGO_SETTINGS_MODULE=core.settings"
    call :RunMigrations "%PROJECT_ROOT%django_backend\.venv\Scripts\python.exe" "%PROJECT_ROOT%django_backend\manage.py" "%LOG_DIR%crypgo-migrate.log"
    if errorlevel 1 exit /b 1
    start "Crypgo Backend" /D "%PROJECT_ROOT%django_backend" "%PROJECT_ROOT%django_backend\.venv\Scripts\python.exe" manage.py runserver %CRYPTOGO_PORT% > "%LOG_DIR%crypgo.log" 2>&1
    call :WaitForService "%CRYPTOGO_HEALTH_URL%" "Crypgo"
    call :Log SUCCESS "Crypgo backend is running on %CRYPTOGO_URL%"
)

if !skip_bot! equ 0 (
    call :Log INFO "Starting Bot Django backend..."
    set "DJANGO_SETTINGS_MODULE=bot_project.settings"
    call :RunMigrations "%PROJECT_ROOT%Bot\venv\Scripts\python.exe" "%PROJECT_ROOT%Bot\manage.py" "%LOG_DIR%bot-migrate.log"
    if errorlevel 1 exit /b 1
    start "Bot Backend" /D "%PROJECT_ROOT%Bot" "%PROJECT_ROOT%Bot\venv\Scripts\python.exe" manage.py runserver %BOT_PORT% > "%LOG_DIR%bot.log" 2>&1
    call :WaitForService "%BOT_URL%/health/" "Bot"
    call :Log SUCCESS "Bot backend is running on %BOT_URL%"
)

if !skip_frontend! equ 0 (
    call :Log INFO "Starting Next.js frontend..."
    start "Frontend" /D "%PROJECT_ROOT%" cmd /c "npm run dev > logs\frontend.log 2>&1"
    call :WaitForService "%FRONTEND_URL%" "Frontend"
    call :Log SUCCESS "Frontend is running on %FRONTEND_URL%"
)

call :Log INFO "Starting Cloudflare Quick Tunnel..."
start "Cloudflare Tunnel" /D "%PROJECT_ROOT%" cmd /c "node start-tunnel.js > logs\cloudflare.log 2>&1"
call :Log INFO "Cloudflare tunnel starting; see %LOG_DIR%\cloudflare.log for the public URL"

call :Log ""
call :Log SUCCESS "============================================================="
call :Log SUCCESS "           All services started successfully!"
call :Log SUCCESS "============================================================="
call :Log ""
call :Log INFO "Services Information:"
call :Log INFO "  Crypgo Backend:   %CRYPTOGO_URL%"
call :Log INFO "  Bot Backend:      %BOT_URL%"
call :Log INFO "  Frontend:         %FRONTEND_URL%"
call :Log INFO "  Logs:             %LOG_DIR%/"
call :Log ""

if defined CLOUDFLARE_URL (
    call :Log SUCCESS "Public Access URL: %CLOUDFLARE_URL%"
    call :Log INFO "📱 You can now access your frontend on your phone!"
    call :Log ""
)

call :Log INFO "Commands:"
call :Log INFO "  • View logs:    type %LOG_DIR%\*.log"
 call :Log INFO "  • Stop services: taskkill /f /im python.exe && taskkill /f /im node.exe && taskkill /f /im cloudflared.exe"
call :Log INFO "  • Restart:       Run this script again"
call :Log ""
call :Log INFO "Press Ctrl+C in a new terminal to stop services"

:MonitorLoop
timeout /t 2 >nul
call :CheckServiceStatus "Crypgo" "%CRYPTOGO_HEALTH_URL%" %CRYPTOGO_PORT% "%PROJECT_ROOT%django_backend\.venv\Scripts\python.exe" "%PROJECT_ROOT%django_backend" manage.py runserver %CRYPTOGO_PORT%
call :CheckServiceStatus "Bot" "%BOT_URL%/health/" %BOT_PORT% "%PROJECT_ROOT%Bot\venv\Scripts\python.exe" "%PROJECT_ROOT%Bot" manage.py runserver %BOT_PORT%
call :CheckServiceStatus "Frontend" "%FRONTEND_URL%" %FRONTEND_PORT% npm "%PROJECT_ROOT%" run dev
timeout /t 120 >nul
goto MonitorLoop

:Log
set "level=%~1"
set "message=%~2"
set "timestamp=%date% %time%"
call :ColorOutput !level! "[!timestamp!] [!level!] !message!"
echo [%timestamp%] [!level!] !message! >> "%LOG_DIR%\dev-startup.log"
exit /b

:ColorOutput
if "%~1"=="INFO" (
    echo [INFO] %~2
) else if "%~1"=="SUCCESS" (
    echo [SUCCESS] %~2
) else if "%~1"=="WARNING" (
    echo [WARNING] %~2
) else if "%~1"=="ERROR" (
    echo [ERROR] %~2
)
exit /b

:CheckPortOpen
set "port=%~1"
set "skip_var=%~2"
set "service_name=%~3"
set "found=0"
for /f "tokens=*" %%P in ('netstat -ano ^| findstr ":%port% .*LISTENING"') do set "found=1"
if !found! equ 1 (
    set "%skip_var%=1"
    call :Log INFO "%service_name% is already running on port %port%"
) else (
    set "%skip_var%=0"
)
exit /b

:RunMigrations
set "migrate_cmd=%~1"
set "manage_file=%~2"
set "migrate_log=%~3"
"%migrate_cmd%" "%manage_file%" migrate > "%migrate_log%" 2>&1
if errorlevel 1 (
    call :Log ERROR "Database migration failed; see %migrate_log%"
    exit /b 1
)
exit /b

:WaitForService
set "service_url=%~1"
set "service_name=%~2"
set "attempts=0"
set "max_attempts=12"

:WaitLoop
if !attempts! geq !max_attempts! (
    call :Log ERROR "%service_name% failed to start within timeout"
    exit /b 1
)

curl -s "%service_url%" >nul 2>&1
if not errorlevel 1 (
    call :Log SUCCESS "%service_name% is ready"
    exit /b 0
)

set /a attempts+=1
if !attempts! lss !max_attempts! (
    call :Log INFO "Waiting for %service_name% (%attempts/%max_attempts%)..."
    timeout /t 5 >nul
)
goto WaitLoop

:CheckServiceStatus
set "service_name=%~1"
set "service_url=%~2"
set "service_port=%~3"
set "service_executable=%~4"
set "service_directory=%~5"
set "service_arguments=%~6 %~7 %~8"

curl -s "%service_url%" >nul 2>&1
if not errorlevel 1 (
    call :Log SUCCESS "✓ %service_name%: RUNNING"
) else (
    call :Log ERROR "✗ %service_name%: DOWN"
    call :Log INFO "  Restarting %service_name%..."
    start "Restarting %service_name%" /D "%service_directory%" "%service_executable%" %service_arguments% > "%LOG_DIR%\%service_name%-restart.log" 2>&1
)

exit /b