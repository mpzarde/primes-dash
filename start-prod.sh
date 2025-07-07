#!/bin/bash

# Primes Dash Production Start Script
echo "Starting Primes Dash in Production Mode..."

# Exit on any error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

print_status "Starting production server..."
print_warning "Backend will run on port 3000 (default)"
print_warning "Frontend static files will be served from backend"
print_warning "Access the app at: http://localhost:3000"
print_warning "Press Ctrl+C to stop the server"

# Start production servers
npm run start:prod
