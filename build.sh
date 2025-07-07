#!/bin/bash

echo "Building Primes Dashboard for production..."

# Build backend
echo "Compiling backend TypeScript to JavaScript..."
cd backend
npm run build
cd ..

# Build frontend
echo "Building frontend Angular app..."
cd frontend
ng build --configuration production
cd ..

echo "Build complete!"
echo "Backend compiled to: backend/dist/"
echo "Frontend built to: frontend/dist/"
