import { Router, Request, Response } from 'express';
import { getSocketService, SOCKET_EVENTS } from '../services/socketService';

const router = Router();

/**
 * GET /api/subscribe
 * Returns Socket.IO connection information and available events
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const socketService = getSocketService();
    const stats = socketService?.getConnectionStats();
    
    res.json({
      success: true,
      data: {
        socketPath: '/socket.io',
        connectionUrl: `ws://localhost:${process.env.PORT || 3001}/socket.io`,
        events: {
          // Events clients can emit
          client: {
            SUBSCRIBE_BATCHES: SOCKET_EVENTS.SUBSCRIBE_BATCHES,
            SUBSCRIBE_JOBS: SOCKET_EVENTS.SUBSCRIBE_JOBS,
            SUBSCRIBE_SOLUTIONS: SOCKET_EVENTS.SUBSCRIBE_SOLUTIONS,
            UNSUBSCRIBE_BATCHES: SOCKET_EVENTS.UNSUBSCRIBE_BATCHES,
            UNSUBSCRIBE_JOBS: SOCKET_EVENTS.UNSUBSCRIBE_JOBS,
            UNSUBSCRIBE_SOLUTIONS: SOCKET_EVENTS.UNSUBSCRIBE_SOLUTIONS,
          },
          // Events server emits
          server: {
            WELCOME: 'welcome',
            SUBSCRIPTION_CONFIRMED: 'subscription:confirmed',
            BATCH_ADDED: SOCKET_EVENTS.BATCH_ADDED,
            BATCH_UPDATED: SOCKET_EVENTS.BATCH_UPDATED,
            JOB_STARTED: SOCKET_EVENTS.JOB_STARTED,
            JOB_COMPLETED: SOCKET_EVENTS.JOB_COMPLETED,
            JOB_FAILED: SOCKET_EVENTS.JOB_FAILED,
            JOB_STATUS_CHANGED: SOCKET_EVENTS.JOB_STATUS_CHANGED,
            SOLUTION_FOUND: SOCKET_EVENTS.SOLUTION_FOUND,
            ERROR: SOCKET_EVENTS.ERROR,
          }
        },
        payloadSchemas: {
          batchAdded: {
            batch: 'Batch object',
            timestamp: 'ISO string'
          },
          batchUpdated: {
            batch: 'Batch object',
            timestamp: 'ISO string'
          },
          jobStatusChanged: {
            jobId: 'string',
            pid: 'number',
            status: 'running | completed | failed',
            startTime: 'ISO string',
            endTime: 'ISO string (optional)',
            duration: 'number in seconds (optional)',
            message: 'string (optional)',
            timestamp: 'ISO string'
          },
          solutionFound: {
            solution: 'Solution object',
            timestamp: 'ISO string'
          },
          error: {
            error: 'string',
            message: 'string',
            timestamp: 'ISO string'
          }
        },
        currentStats: stats || { connectedClients: 0, rooms: [] }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in subscribe endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription information',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/subscribe/stats
 * Returns current Socket.IO connection statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const socketService = getSocketService();
    const stats = socketService?.getConnectionStats();
    
    res.json({
      success: true,
      data: stats || { connectedClients: 0, rooms: [] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting socket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get socket statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/subscribe/test
 * Test endpoint to manually trigger Socket.IO events (for development)
 */
router.post('/test', (req: Request, res: Response) => {
  try {
    const { eventType, data } = req.body;
    const socketService = getSocketService();
    
    if (!socketService) {
      res.status(500).json({
        success: false,
        error: 'Socket service not initialized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    switch (eventType) {
      case 'batch_added':
        socketService.emitBatchAdded(data);
        break;
      case 'job_started':
        socketService.emitJobStarted(data.jobId, data.pid, new Date());
        break;
      case 'job_completed':
        socketService.emitJobCompleted(data.jobId, data.pid, new Date(data.startTime), new Date(), data.message);
        break;
      case 'job_failed':
        socketService.emitJobFailed(data.jobId, data.pid, new Date(data.startTime), new Date(), data.message);
        break;
      case 'solution_found':
        socketService.emitSolutionFound(data);
        break;
      case 'error':
        socketService.emitError(data.error, data.message);
        break;
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid event type',
          availableTypes: ['batch_added', 'job_started', 'job_completed', 'job_failed', 'solution_found', 'error'],
          timestamp: new Date().toISOString()
        });
        return;
    }

    res.json({
      success: true,
      message: `Test event '${eventType}' emitted successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to emit test event',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
