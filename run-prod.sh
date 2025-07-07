#!/bin/bash

# Primes Dash Production Run Script
# This script combines build and start functionality and adds background processing

# Exit on any error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=3000
PID_FILE="./primes-dash.pid"
LOG_FILE="./primes-dash.log"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_command() {
    echo -e "${BLUE}[COMMAND]${NC} $1"
}

# Function to check if the server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null; then
            return 0 # Running
        else
            # PID file exists but process is not running
            rm "$PID_FILE" 2>/dev/null
        fi
    fi
    return 1 # Not running
}

# Function to display usage information
show_usage() {
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  start    - Build and start the server in the background"
    echo "  stop     - Stop the running server"
    echo "  status   - Check if the server is running"
    echo "  logs     - Display the server logs"
    echo "  help     - Show this help message"
    echo
    echo "If no command is provided, 'start' is assumed."
}

# Function to build the application
build_app() {
    print_status "Building Primes Dashboard for production..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi

    print_status "Installing dependencies..."
    npm run install:all

    print_status "Building backend..."
    npm run build:backend

    print_status "Building frontend for production..."
    npm run build:frontend

    print_status "Build complete!"
}

# Function to start the server in the background
start_server() {
    if is_running; then
        print_warning "Server is already running with PID $(cat "$PID_FILE")"
        print_command "Use '$0 status' to check status"
        print_command "Use '$0 logs' to view logs"
        return
    fi

    print_status "Starting production server in the background..."
    NODE_ENV=production nohup node backend/dist/index.js > "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    
    # Wait a moment to see if the process stays alive
    sleep 2
    if ps -p "$PID" > /dev/null; then
        print_status "Server started successfully with PID $PID"
        print_warning "Backend is running on port $PORT"
        print_warning "Frontend static files are served from backend"
        print_warning "Access the app at: http://localhost:$PORT"
        print_command "Use '$0 status' to check status"
        print_command "Use '$0 logs' to view logs"
        print_command "Use '$0 stop' to stop the server"
    else
        print_error "Server failed to start. Check logs for details."
        print_command "Use '$0 logs' to view logs"
        rm "$PID_FILE" 2>/dev/null
    fi
}

# Function to stop the server
stop_server() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        print_status "Stopping server with PID $PID..."
        kill "$PID"
        
        # Wait for process to terminate
        for i in {1..10}; do
            if ! ps -p "$PID" > /dev/null; then
                break
            fi
            sleep 1
        done
        
        # If process is still running, force kill
        if ps -p "$PID" > /dev/null; then
            print_warning "Server did not terminate gracefully. Forcing termination..."
            kill -9 "$PID"
        fi
        
        rm "$PID_FILE"
        print_status "Server stopped successfully"
    else
        print_warning "Server is not running"
    fi
}

# Function to check server status
check_status() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        UPTIME=$(ps -o etime= -p "$PID")
        print_status "Server is running with PID $PID"
        print_status "Uptime: $UPTIME"
        print_status "Port: $PORT"
        print_command "Use '$0 logs' to view logs"
        print_command "Use '$0 stop' to stop the server"
    else
        print_warning "Server is not running"
        print_command "Use '$0 start' to start the server"
    fi
}

# Function to display logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        if [ "$1" == "follow" ]; then
            tail -f "$LOG_FILE"
        else
            # Show last 50 lines by default
            tail -n 50 "$LOG_FILE"
            print_command "Use '$0 logs follow' to follow logs in real-time"
        fi
    else
        print_error "Log file not found"
        if is_running; then
            print_warning "Server is running but no log file exists"
        else
            print_warning "Server is not running"
        fi
    fi
}

# Main script logic
case "$1" in
    start)
        build_app
        start_server
        ;;
    stop)
        stop_server
        ;;
    status)
        check_status
        ;;
    logs)
        if [ "$2" == "follow" ]; then
            show_logs "follow"
        else
            show_logs
        fi
        ;;
    help)
        show_usage
        ;;
    "")
        # Default action if no command is provided
        build_app
        start_server
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac

exit 0
