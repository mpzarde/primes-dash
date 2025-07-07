# Deployment Guide

## Development vs Production Modes

### Development Mode (Recommended)
**How it works:**
- Backend runs on port 3000 (TypeScript compiled on-the-fly with ts-node)
- Frontend is pre-built and served by the backend
- Single process, single port
- No CORS issues (everything served from same origin)

**Use for:**
- Local development
- IDE debugging
- Consistent environment with production

**Start with:**
```bash
# Build frontend and start backend
npm start
# or explicitly
npm run start:dev
```


### Production Mode (For Deployment)
**How it works:**
- Backend compiles TypeScript to JavaScript first
- Frontend builds to static HTML/CSS/JS files
- Backend serves both API and frontend files on port 3000
- Single process, single port, faster performance
- Can run in the background with status monitoring

**Use for:**
- Sharing with others via ngrok/tunnels
- Better performance (compiled code)
- Simpler deployment (one URL)
- Production-like environment
- Long-running deployments

**Build and start:**
```bash
# Build and start in one command (runs in background)
./run-prod.sh

# Additional commands
./run-prod.sh start    # Build and start the server in the background
./run-prod.sh stop     # Stop the running server
./run-prod.sh status   # Check if the server is running
./run-prod.sh logs     # Display the server logs
./run-prod.sh logs follow  # Follow the logs in real-time
```

## Why Use Production Mode for Sharing?

1. **Single URL**: Friends only need `http://your-tunnel.com` instead of managing two ports
2. **Better Performance**: Compiled code runs faster than interpreted TypeScript
3. **Smaller Bundle**: Angular production build is optimized and minified
4. **No CORS Issues**: Frontend and backend served from same origin
5. **Easier with Tunnels**: ngrok/Cloudflare only need to expose one port

## File Structure After Build

```
primes-dash/
├── backend/
│   ├── src/           # Source TypeScript
│   └── dist/          # Compiled JavaScript (created by build)
├── frontend/
│   ├── src/           # Source Angular
│   └── dist/          # Built static files (created by build)
├── run-prod.sh        # Build and run in production mode
├── primes-dash.pid    # PID file (created when server is running)
└── primes-dash.log    # Log file (created when server is running)
```

## Quick Start Commands

```bash
# Recommended Development Mode (single process)
npm start                   # Build frontend and start backend

# Backend Development Only
cd backend && npm run dev   # Start backend only

# Frontend Development Only (not recommended for most cases)
cd frontend && npm start    # Start frontend dev server only

# Production (single process)
./run-prod.sh                # Build and start in background
./run-prod.sh status         # Check server status
./run-prod.sh logs           # View logs
./run-prod.sh stop           # Stop the server
```
