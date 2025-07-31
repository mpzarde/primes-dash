import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { config } from './config';
import { initLogParser } from './services/logParser';
import { initializeSocketService } from './services/socketService';
import batchesRouter from './routes/batches';
import solutionsRouter from './routes/solutions';
import stateRouter from './routes/state';
import jobRouter from './routes/job';
import subscribeRouter from './routes/subscribe';
import configRouter from './routes/config';
import uploadRouter from './routes/upload';
import { getCurrentTimestampWithoutTimezone } from './utils/dateUtils';

// Create Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const socketService = initializeSocketService(httpServer);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));  // Increased limit for file uploads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${getCurrentTimestampWithoutTimezone()} - ${req.method} ${req.path}`);
  next();
});

// Routes - keep existing API routes for backward compatibility
app.use('/api/batches', batchesRouter);
app.use('/api/solutions', solutionsRouter);
app.use('/api/state', stateRouter);
app.use('/api/job', jobRouter);
app.use('/api/subscribe', subscribeRouter);
app.use('/api/config', configRouter);
app.use('/api/upload', uploadRouter);

// Add prefixed API routes under /pdash
app.use('/pdash/api/batches', batchesRouter);
app.use('/pdash/api/solutions', solutionsRouter);
app.use('/pdash/api/state', stateRouter);
app.use('/pdash/api/job', jobRouter);
app.use('/pdash/api/subscribe', subscribeRouter);
app.use('/pdash/api/config', configRouter);
app.use('/pdash/api/upload', uploadRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: getCurrentTimestampWithoutTimezone() });
});

// Serve frontend static files from this backend server in all environments
// This allows everything to run on a single port (3000) instead of separate dev servers
// Benefits: easier deployment, single URL for sharing, no CORS issues
const frontendPath = path.join(__dirname, '../../frontend/dist/frontend');

// Serve static files (CSS, JS, images) from Angular build output
app.use(express.static(frontendPath));

// Also serve static files at /pdash/ path for tunnel routing
app.use("/pdash", express.static(frontendPath));

// Catch-all handler: send index.html for any non-API routes
// This enables Angular client-side routing to work properly
app.get('*', (req, res, next) => {
  // Only serve the frontend if the path doesn't start with /api and /pdash/api
  if (!req.path.startsWith('/api') && !req.path.startsWith('/pdash/api') && !req.path.startsWith('/socket.io')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    next();
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Primes Dashboard API', 
    version: '1.0.0',
    endpoints: [
      'GET /api/batches',
      'GET /api/solutions', 
      'GET /api/state',
      'POST /api/job/next',
      'GET /api/subscribe',
      'GET /api/subscribe/stats',
      'POST /api/subscribe/test'
    ],
    websocket: {
      path: '/socket.io',
      url: `ws://localhost:${config.port}/socket.io`
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: getCurrentTimestampWithoutTimezone()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    timestamp: getCurrentTimestampWithoutTimezone()
  });
});

// Initialize log parser with file watching
initLogParser({ watchForNewFiles: true, watchDelay: 1000 });

// Start server
const PORT = config.port;
httpServer.listen(PORT, () => {
  console.log(`🚀 Primes Dashboard API server running on port ${PORT}`);
  console.log(`📁 Monitoring logs at: ${config.logsPath}`);
  console.log(`🌐 API available at: http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO enabled at: ws://localhost:${PORT}/socket.io`);
});

// Export for testing
export default app;
