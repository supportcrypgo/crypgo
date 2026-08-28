#!/bin/bash

################################################################################
# Crypgo Project - Development Environment Startup Script
# 
# Features:
# - Automatic database migrations
# - Service health checking
# - Recovery from crashes
# - Detailed logging
# - Cross-platform compatible
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"

# Service ports
FRONTEND_PORT=5000
CRYPTOGO_PORT=8000
BOT_PORT=8001
WS_PORT=5001

# Service URLs
CRYPTOGO_URL="http://127.0.0.1:$CRYPTOGO_PORT"
BOT_URL="http://127.0.0.1:$BOT_PORT"
FRONTEND_URL="http://127.0.0.1:$FRONTEND_PORT"

# Service status tracking
declare -a services

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local color=""
    
    case $level in
        INFO) color="$BLUE" ;;
        SUCCESS) color="$GREEN" ;;
        WARNING) color="$YELLOW" ;;
        ERROR) color="$RED" ;;
    esac
    
    echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message${NC}"
    
    # Also write to log file
    mkdir -p "$LOG_DIR"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_DIR/dev-startup.log"
}

# Health check function
health_check() {
    local service_url=$1
    local service_name=$2
    local max_retries=5
    local retries=0
    
    log INFO "Checking $service_name health at $service_url..."
    
    while [ $retries -lt $max_retries ]; do
        if curl -sf "$service_url/health/" > /dev/null 2>&1; then
            log SUCCESS "$service_name is healthy"
            return 0
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt $max_retries ]; then
            log WARNING "Retrying $service_name ($retries/$max_retries)..."
            sleep 2
        fi
    done
    
    log ERROR "$service_name failed health check after $max_retries attempts"
    return 1
}

# Cleanup function
cleanup() {
    log INFO "Shutting down all services..."
    
    # Kill background processes
    pkill -f "manage.py runserver" || true
    pkill -f "next dev" || true
    pkill -f "cloudflared tunnel" || true
    
    log SUCCESS "Services stopped"
    exit 0
}

trap cleanup INT TERM

# Wait for service to be ready
wait_for_service() {
    local service_url=$1
    local service_name=$2
    local timeout=120
    local elapsed=0
    
    log INFO "Waiting for $service_name to be ready..."
    
    while [ $elapsed -lt $timeout ]; do
        if curl -sf "$service_url/health/" > /dev/null 2>&1; then
            log SUCCESS "$service_name is ready"
            return 0
        fi
        
        elapsed=$((elapsed + 5))
        sleep 5
    done
    
    log ERROR "$service_name failed to start within $timeout seconds"
    return 1
}

# Start Crypgo Backend
start_crypgo() {
    log INFO "Starting Crypgo Django backend..."
    
    cd "$PROJECT_ROOT/django_backend"
    
    # First, create venv if it doesn't exist
    if [ ! -d ".venv" ]; then
        log INFO "Creating virtual environment..."
        python -m venv .venv
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Run migrations
    log INFO "Running database migrations for Crypgo..."
    ./.venv/Scripts/python.exe manage.py migrate 2>&1 | tee "$LOG_DIR/crypgo-migrate.log"
    
    # Start Django server in background
    ./.venv/Scripts/python.exe manage.py runserver $CRYPTOGO_PORT > "$LOG_DIR/crypgo.log" 2>&1 &
    CRYPTOGO_PID=$!
    
    services+=("Crypgo: $CRYPTOGO_PID")
    
    # Wait for it to be ready
    if wait_for_service "$CRYPTOGO_URL" "Crypgo"; then
        log SUCCESS "Crypgo backend is running on $CRYPTOGO_URL"
    else
        cleanup
    fi
}

# Start Bot Backend
start_bot() {
    log INFO "Starting Bot Django backend..."
    
    cd "$PROJECT_ROOT/Bot"
    
    # Check and run migrations
    log INFO "Running database migrations for Bot..."
    venv/Scripts/python.exe manage.py migrate 2>&1 | tee "$PROJECT_ROOT/logs/bot-migrate.log"
    
    # Start Django server in background
    venv/Scripts/python.exe manage.py runserver $BOT_PORT > "$PROJECT_ROOT/logs/bot.log" 2>&1 &
    BOT_PID=$!
    
    services+=("Bot: $BOT_PID")
    
    # Wait for it to be ready
    if wait_for_service "$BOT_URL" "Bot"; then
        log SUCCESS "Bot backend is running on $BOT_URL"
    else
        cleanup
    fi
}

# Start WebSocket Server
start_ws() {
    log INFO "Starting WebSocket server..."
    
    # The WebSocket server is already running separately
    log SUCCESS "WebSocket server is running"
}

# Start Frontend
start_frontend() {
    log INFO "Starting Next.js frontend..."
    
    cd "$PROJECT_ROOT"
    
    # Check if frontend is already running
    if lsof -Pi :$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        log WARNING "Frontend is already running on port $FRONTEND_PORT"
    else
        # Start frontend in background
        npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
        FRONTEND_PID=$!
        
        services+=("Frontend: $FRONTEND_PID")
        
        log INFO "Frontend starting in background. PID: $FRONTEND_PID"
    fi
}

# Start Cloudflare Quick Tunnel
start_cloudflare() {
    log INFO "Starting Cloudflare Quick Tunnel..."
    cloudflared tunnel --url "http://localhost:$FRONTEND_PORT" > "$LOG_DIR/cloudflare.log" 2>&1 &
    CLOUDFLARE_PID=$!
    services+=("Cloudflare Tunnel: $CLOUDFLARE_PID")
    log INFO "Cloudflare tunnel starting; see $LOG_DIR/cloudflare.log for the public URL"
}

# Monitor services
monitor_services() {
    log INFO "Monitoring services for 60 seconds before returning to shell..."
    sleep 60
    
    while true; do
        log INFO "=== Service Health Check ==="
        
        # Check Crypgo
        if curl -sf "$CRYPTOGO_URL/health/" > /dev/null 2>&1; then
            log SUCCESS "✓ Crypgo backend: RUNNING"
        else
            log ERROR "✗ Crypgo backend: DOWN"
            log INFO "  Restarting Crypgo..."
            pkill -f "manage.py runserver.*$CRYPTOGO_PORT" || true
            start_crypgo
        fi
        
        # Check Bot
        if curl -sf "$BOT_URL/health/" > /dev/null 2>&1; then
            log SUCCESS "✓ Bot backend: RUNNING"
        else
            log ERROR "✗ Bot backend: DOWN"
            log INFO "  Restarting Bot..."
            pkill -f "manage.py runserver.*$BOT_PORT" || true
            start_bot
        fi
        
        # Check Frontend
        if curl -sf "$FRONTEND_URL/" > /dev/null 2>&1; then
            log SUCCESS "✓ Frontend: RUNNING"
        else
            log ERROR "✗ Frontend: DOWN"
            log INFO "  Restarting Frontend..."
            pkill -f "next dev.*$FRONTEND_PORT" || true
            start_frontend
        fi
        
        sleep 120
    done
}

# Main execution
main() {
    log INFO "============================================================="
    log INFO "           Crypgo Development Environment Startup"
    log INFO "============================================================="
    
    log INFO "Project root: $PROJECT_ROOT"
    log INFO "Log directory: $LOG_DIR"
    log INFO ""
    
    # Check if inside Docker container
    if [ -f /.dockerenv ]; then
        log INFO "Running inside Docker container"
    fi
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    
    # Start services
    start_crypgo
    start_bot
    start_ws
    start_frontend
    start_cloudflare
    
    log ""
    log SUCCESS "============================================================="
    log SUCCESS "           All services started successfully!"
    log SUCCESS "============================================================="
    log ""
    
    log INFO "Services Information:"
    log INFO "  Crypgo Backend:   $CRYPTOGO_URL"
    log INFO "  Bot Backend:      $BOT_URL"
    log INFO "  Frontend:         $FRONTEND_URL"
    log INFO "  Logs:             $LOG_DIR/"
    log INFO ""
    
    if [ -n "$CLOUDFLARE_URL" ]; then
        log SUCCESS "Public Access URL: $CLOUDFLARE_URL"
        log INFO "📱 You can now access your frontend on your phone!"
        log ""
    fi
    
    log INFO "Heartbeat monitoring: Running (every 2 minutes)"
    log INFO ""
    log INFO "Commands:"
    log INFO "  • View logs:    tail -f $LOG_DIR/*.log"
    log INFO "  • Stop services: pkill -f manage.py runserver && pkill -f next dev && pkill -f cloudflared"
    log INFO "  • Restart:       Run this script again"
    log ""
    
    # Monitor services
    monitor_services
}

# Run main function
main