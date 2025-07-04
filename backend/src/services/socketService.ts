import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Batch, Solution } from '../types';

// Socket.IO event names
export const SOCKET_EVENTS = {
  // Client events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  SUBSCRIBE_BATCHES: 'subscribe:batches',
  SUBSCRIBE_JOBS: 'subscribe:jobs',
  SUBSCRIBE_SOLUTIONS: 'subscribe:solutions',
  UNSUBSCRIBE_BATCHES: 'unsubscribe:batches',
  UNSUBSCRIBE_JOBS: 'unsubscribe:jobs',
  UNSUBSCRIBE_SOLUTIONS: 'unsubscribe:solutions',
  
  // Server events
  BATCH_ADDED: 'batch:added',
  BATCH_UPDATED: 'batch:updated',
  JOB_STARTED: 'job:started',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  JOB_STATUS_CHANGED: 'job:status_changed',
  SOLUTION_FOUND: 'solution:found',
  ERROR: 'error'
} as const;

// Event payload types
export interface BatchAddedPayload {
  batch: Batch;
  timestamp: string;
}

export interface BatchUpdatedPayload {
  batch: Batch;
  timestamp: string;
}

export interface JobStatusPayload {
  jobId: string;
  pid: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  message?: string;
  timestamp: string;
}

export interface SolutionFoundPayload {
  solution: Solution;
  timestamp: string;
}

export interface ErrorPayload {
  error: string;
  message: string;
  timestamp: string;
}

// Socket.IO service class
export class SocketService {
  private io: SocketIOServer;
  private connectedClients: Set<string> = new Set();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Configure this for production
        methods: ["GET", "POST"]
      },
      path: '/socket.io'
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // Send welcome message
      socket.emit('welcome', {
        message: 'Connected to Primes Dashboard real-time updates',
        clientId: socket.id,
        timestamp: new Date().toISOString()
      });

      // Handle subscription requests
      socket.on(SOCKET_EVENTS.SUBSCRIBE_BATCHES, () => {
        socket.join('batches');
        console.log(`Client ${socket.id} subscribed to batch updates`);
        socket.emit('subscription:confirmed', {
          type: 'batches',
          timestamp: new Date().toISOString()
        });
      });

      socket.on(SOCKET_EVENTS.SUBSCRIBE_JOBS, () => {
        socket.join('jobs');
        console.log(`Client ${socket.id} subscribed to job updates`);
        socket.emit('subscription:confirmed', {
          type: 'jobs',
          timestamp: new Date().toISOString()
        });
      });

      socket.on(SOCKET_EVENTS.SUBSCRIBE_SOLUTIONS, () => {
        socket.join('solutions');
        console.log(`Client ${socket.id} subscribed to solution updates`);
        socket.emit('subscription:confirmed', {
          type: 'solutions',
          timestamp: new Date().toISOString()
        });
      });

      // Handle unsubscription requests
      socket.on(SOCKET_EVENTS.UNSUBSCRIBE_BATCHES, () => {
        socket.leave('batches');
        console.log(`Client ${socket.id} unsubscribed from batch updates`);
      });

      socket.on(SOCKET_EVENTS.UNSUBSCRIBE_JOBS, () => {
        socket.leave('jobs');
        console.log(`Client ${socket.id} unsubscribed from job updates`);
      });

      socket.on(SOCKET_EVENTS.UNSUBSCRIBE_SOLUTIONS, () => {
        socket.leave('solutions');
        console.log(`Client ${socket.id} unsubscribed from solution updates`);
      });

      // Handle disconnection
      socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error from ${socket.id}:`, error);
      });
    });
  }

  // Emit batch added event
  public emitBatchAdded(batch: Batch): void {
    const payload: BatchAddedPayload = {
      batch,
      timestamp: new Date().toISOString()
    };
    
    this.io.to('batches').emit(SOCKET_EVENTS.BATCH_ADDED, payload);
    console.log(`Emitted batch added event: ${batch.id}`);
  }

  // Emit batch updated event
  public emitBatchUpdated(batch: Batch): void {
    const payload: BatchUpdatedPayload = {
      batch,
      timestamp: new Date().toISOString()
    };
    
    this.io.to('batches').emit(SOCKET_EVENTS.BATCH_UPDATED, payload);
    console.log(`Emitted batch updated event: ${batch.id}`);
  }

  // Emit job started event
  public emitJobStarted(jobId: string, pid: number, startTime: Date): void {
    const payload: JobStatusPayload = {
      jobId,
      pid,
      status: 'running',
      startTime: startTime.toISOString(),
      timestamp: new Date().toISOString()
    };
    
    this.io.to('jobs').emit(SOCKET_EVENTS.JOB_STARTED, payload);
    this.io.to('jobs').emit(SOCKET_EVENTS.JOB_STATUS_CHANGED, payload);
    console.log(`Emitted job started event: ${jobId} (PID: ${pid})`);
  }

  // Emit job completed event
  public emitJobCompleted(jobId: string, pid: number, startTime: Date, endTime: Date, message?: string): void {
    const duration = endTime.getTime() - startTime.getTime();
    const payload: JobStatusPayload = {
      jobId,
      pid,
      status: 'completed',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: Math.round(duration / 1000), // Convert to seconds
      message,
      timestamp: new Date().toISOString()
    };
    
    this.io.to('jobs').emit(SOCKET_EVENTS.JOB_COMPLETED, payload);
    this.io.to('jobs').emit(SOCKET_EVENTS.JOB_STATUS_CHANGED, payload);
    console.log(`Emitted job completed event: ${jobId} (Duration: ${payload.duration}s)`);
  }

  // Emit job failed event
  public emitJobFailed(jobId: string, pid: number, startTime: Date, endTime: Date, message?: string): void {
    const duration = endTime.getTime() - startTime.getTime();
    const payload: JobStatusPayload = {
      jobId,
      pid,
      status: 'failed',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: Math.round(duration / 1000), // Convert to seconds
      message,
      timestamp: new Date().toISOString()
    };
    
    this.io.to('jobs').emit(SOCKET_EVENTS.JOB_FAILED, payload);
    this.io.to('jobs').emit(SOCKET_EVENTS.JOB_STATUS_CHANGED, payload);
    console.log(`Emitted job failed event: ${jobId} (Duration: ${payload.duration}s)`);
  }

  // Emit solution found event
  public emitSolutionFound(solution: Solution): void {
    const payload: SolutionFoundPayload = {
      solution,
      timestamp: new Date().toISOString()
    };
    
    this.io.to('solutions').emit(SOCKET_EVENTS.SOLUTION_FOUND, payload);
    console.log(`Emitted solution found event: ${solution.id}`);
  }

  // Emit error event
  public emitError(error: string, message: string): void {
    const payload: ErrorPayload = {
      error,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.io.emit(SOCKET_EVENTS.ERROR, payload);
    console.log(`Emitted error event: ${error}`);
  }

  // Get connection statistics
  public getConnectionStats(): { connectedClients: number; rooms: string[] } {
    const rooms = Array.from(this.io.sockets.adapter.rooms.keys())
      .filter(room => !this.connectedClients.has(room)); // Filter out client IDs
    
    return {
      connectedClients: this.connectedClients.size,
      rooms
    };
  }

  // Get the Socket.IO server instance
  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Export a singleton instance
let socketService: SocketService | null = null;

export function initializeSocketService(server: HTTPServer): SocketService {
  if (!socketService) {
    socketService = new SocketService(server);
  }
  return socketService;
}

export function getSocketService(): SocketService | null {
  return socketService;
}
