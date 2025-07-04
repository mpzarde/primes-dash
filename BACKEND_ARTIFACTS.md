# Express/Node Backend Artifacts

## Project Structure
- **Backend Framework**: Express.js with TypeScript
- **Build Configuration**: TypeScript compilation with `dist/` output directory
- **Environment**: Node.js with dotenv for environment variables
- **Development Server**: ts-node-dev for live reloading

## Key Files Ignored

### Build Outputs (Transpiled Code)
- `dist/` - TypeScript compilation output directory (configured in tsconfig.json)
- `build/` - Alternative build output directory
- `*.tsbuildinfo` - TypeScript incremental compilation cache

### Environment Files
- `.env` - Main environment configuration file (found in backend/)
- `.env.local` - Local environment overrides
- `.env.development.local` - Development environment overrides
- `.env.test.local` - Test environment overrides  
- `.env.production.local` - Production environment overrides

### Dependencies
- `node_modules/` - Node.js package dependencies
- `package-lock.json` - NPM lock file (tracked for reproducible builds)
- `yarn.lock` - Yarn lock file (tracked for reproducible builds)

### Logs and Temporary Files
- `*.log` - All log files
- `npm-debug.log*` - NPM debug logs
- `yarn-debug.log*` - Yarn debug logs
- `yarn-error.log*` - Yarn error logs
- `lerna-debug.log*` - Lerna debug logs
- `logs/` - Log directories
- `tmp/` - Temporary directories
- `temp/` - Temporary directories

### Runtime and Cache Files
- `*.pid` - Process ID files
- `*.seed` - Random seed files
- `*.pid.lock` - Process lock files
- `.npm` - NPM cache directory
- `.eslintcache` - ESLint cache
- `coverage/` - Code coverage reports
- `.nyc_output/` - NYC test coverage output

### Development Tools
- `.vscode/` - VS Code settings
- `.idea/` - IntelliJ IDEA settings
- `*.swp`, `*.swo` - Vim swap files

### OS Files
- `.DS_Store` - macOS Finder metadata
- `Thumbs.db` - Windows thumbnail cache
- `ehthumbs.db` - Windows thumbnail cache

## Backend Package Configuration

### Dependencies
- **Express**: Web framework
- **Socket.IO**: Real-time communication
- **TypeScript**: Static typing
- **CORS**: Cross-origin resource sharing
- **Dotenv**: Environment variable management
- **Chokidar**: File watching

### Development Dependencies
- **ts-node-dev**: TypeScript development server
- **@types packages**: TypeScript type definitions

## TypeScript Configuration
- **Target**: ES2020
- **Module**: CommonJS
- **Output Directory**: `./dist`
- **Source Directory**: `./src`
- **Source Maps**: Enabled
- **Declarations**: Enabled

## Environment Variables
The backend uses a `.env` file for configuration. This file is ignored to prevent sensitive data from being committed to version control.

## Build Process
The backend uses TypeScript compilation with output to the `dist/` directory. The build artifacts are ignored as they can be regenerated from source code.
