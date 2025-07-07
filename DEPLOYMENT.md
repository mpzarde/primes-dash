# Deployment Guide

## Development vs Production Modes

### Development Mode (Default)
**How it works:**
- Backend runs on port 3000 (TypeScript compiled on-the-fly with ts-node)
- Frontend runs on port 4200 (Angular dev server with hot reload)
- Two separate processes, two separate ports
- CORS enabled for cross-origin requests between ports

**Use for:**
- Local development
- IDE debugging
- Hot reload during coding

**Start with:**
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2  
cd frontend && ng serve
```

### Production Mode (For Deployment)
**How it works:**
- Backend compiles TypeScript to JavaScript first
- Frontend builds to static HTML/CSS/JS files
- Backend serves both API and frontend files on port 3000
- Single process, single port, faster performance

**Use for:**
- Sharing with others via ngrok/tunnels
- Better performance (compiled code)
- Simpler deployment (one URL)
- Production-like environment

**Build and start:**
```bash
# Build both apps
./build.sh

# Start in production mode
./start-prod.sh
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
└── build.sh           # Compiles both apps
```

## Quick Start Commands

```bash
# Development (two terminals)
npm run dev                 # Backend only
ng serve                    # Frontend only

# Production (single process)
./build.sh && ./start-prod.sh
```
