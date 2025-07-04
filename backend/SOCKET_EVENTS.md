# Socket.IO Real-Time Events Documentation

This document describes the Socket.IO events and their payload shapes for the Primes Dashboard API.

## Connection Information

- **Socket.IO Path**: `/socket.io`
- **Connection URL**: `ws://localhost:3001/socket.io`
- **Namespace**: Default (`/`)

## Client Events (Events clients can emit)

### Subscription Events

#### `subscribe:batches`
Subscribe to batch-related events.
```javascript
socket.emit('subscribe:batches');
```

#### `subscribe:jobs`
Subscribe to job-related events.
```javascript
socket.emit('subscribe:jobs');
```

#### `subscribe:solutions`
Subscribe to solution-related events.
```javascript
socket.emit('subscribe:solutions');
```

### Unsubscription Events

#### `unsubscribe:batches`
Unsubscribe from batch-related events.
```javascript
socket.emit('unsubscribe:batches');
```

#### `unsubscribe:jobs`
Unsubscribe from job-related events.
```javascript
socket.emit('unsubscribe:jobs');
```

#### `unsubscribe:solutions`
Unsubscribe from solution-related events.
```javascript
socket.emit('unsubscribe:solutions');
```

## Server Events (Events server emits)

### Connection Events

#### `welcome`
Sent immediately after a client connects.
```typescript
interface WelcomePayload {
  message: string;
  clientId: string;
  timestamp: string; // ISO date string
}
```

Example:
```json
{
  "message": "Connected to Primes Dashboard real-time updates",
  "clientId": "abc123def456",
  "timestamp": "2025-07-04T04:30:00.000Z"
}
```

#### `subscription:confirmed`
Sent after a successful subscription to an event type.
```typescript
interface SubscriptionConfirmedPayload {
  type: 'batches' | 'jobs' | 'solutions';
  timestamp: string; // ISO date string
}
```

Example:
```json
{
  "type": "batches",
  "timestamp": "2025-07-04T04:30:00.000Z"
}
```

### Batch Events

#### `batch:added`
Emitted when a new batch summary is added to summary.log.
```typescript
interface BatchAddedPayload {
  batch: Batch;
  timestamp: string; // ISO date string
}

interface Batch {
  id: string;
  timestamp: Date;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  parameters?: Record<string, any>;
  logFile: string;
  summary?: string;
}
```

Example:
```json
{
  "batch": {
    "id": "batch_1-50_1720064600000",
    "timestamp": "2025-07-01T00:00:00.000Z",
    "status": "completed",
    "startTime": "2025-07-01T00:00:00.000Z",
    "endTime": "2025-07-01T04:17:30.450Z",
    "duration": 15450.45,
    "parameters": {
      "aRange": "1-50",
      "checked": 50000000000000,
      "found": 22,
      "rps": 3236151232
    },
    "logFile": "run_1-50.log",
    "summary": "a_range=1-50 checked=50000000000000 found=22 elapsed=15450.45s rps=3236151232"
  },
  "timestamp": "2025-07-04T04:30:00.000Z"
}
```

#### `batch:updated`
Emitted when an existing batch is updated.
```typescript
interface BatchUpdatedPayload {
  batch: Batch;
  timestamp: string; // ISO date string
}
```

### Job Events

#### `job:started`
Emitted when a new batch job is started.
```typescript
interface JobStatusPayload {
  jobId: string;
  pid: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string; // ISO date string
  endTime?: string; // ISO date string
  duration?: number; // in seconds
  message?: string;
  timestamp: string; // ISO date string
}
```

Example:
```json
{
  "jobId": "job_1720064600000_12345",
  "pid": 12345,
  "status": "running",
  "startTime": "2025-07-04T04:30:00.000Z",
  "timestamp": "2025-07-04T04:30:00.000Z"
}
```

#### `job:completed`
Emitted when a batch job completes successfully.
```typescript
// Uses JobStatusPayload interface
```

Example:
```json
{
  "jobId": "job_1720064600000_12345",
  "pid": 12345,
  "status": "completed",
  "startTime": "2025-07-04T04:30:00.000Z",
  "endTime": "2025-07-04T04:45:30.000Z",
  "duration": 930,
  "message": "Job completed successfully in 930s",
  "timestamp": "2025-07-04T04:45:30.000Z"
}
```

#### `job:failed`
Emitted when a batch job fails.
```typescript
// Uses JobStatusPayload interface
```

Example:
```json
{
  "jobId": "job_1720064600000_12345",
  "pid": 12345,
  "status": "failed",
  "startTime": "2025-07-04T04:30:00.000Z",
  "endTime": "2025-07-04T04:32:15.000Z",
  "duration": 135,
  "message": "Job failed with exit code 1. Error: Permission denied",
  "timestamp": "2025-07-04T04:32:15.000Z"
}
```

#### `job:status_changed`
Emitted whenever a job status changes (running → completed/failed).
```typescript
// Uses JobStatusPayload interface
```

### Solution Events

#### `solution:found`
Emitted when a new solution is found in log files.
```typescript
interface SolutionFoundPayload {
  solution: Solution;
  timestamp: string; // ISO date string
}

interface Solution {
  id: string;
  batchId: string;
  timestamp: Date;
  cubesCount: number;
  parameterCombination: {
    a: number;
    b: number;
    c: number;
    d: number;
  };
  logFile: string;
  lineNumber: number;
  rawLine: string;
}
```

Example:
```json
{
  "solution": {
    "id": "solution_run_1-50_1234_0_1720064600000",
    "batchId": "run_1-50",
    "timestamp": "2025-07-04T04:30:00.000Z",
    "cubesCount": 15,
    "parameterCombination": {
      "a": 2,
      "b": 3,
      "c": 7,
      "d": 42
    },
    "logFile": "run_1-50.log",
    "lineNumber": 1234,
    "rawLine": "(2, 3, 7, 42) -> Found 15 cubes of primes"
  },
  "timestamp": "2025-07-04T04:30:00.000Z"
}
```

### Error Events

#### `error`
Emitted when an error occurs in the system.
```typescript
interface ErrorPayload {
  error: string;
  message: string;
  timestamp: string; // ISO date string
}
```

Example:
```json
{
  "error": "LOG_PARSE_ERROR",
  "message": "Failed to parse summary.log: File not found",
  "timestamp": "2025-07-04T04:30:00.000Z"
}
```

## Usage Examples

### Basic Connection and Subscription

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001');

// Listen for connection
socket.on('connect', () => {
  console.log('Connected to server');
  
  // Subscribe to batch and job updates
  socket.emit('subscribe:batches');
  socket.emit('subscribe:jobs');
});

// Listen for welcome message
socket.on('welcome', (data) => {
  console.log('Welcome:', data.message);
});

// Listen for subscription confirmations
socket.on('subscription:confirmed', (data) => {
  console.log(`Subscribed to ${data.type} updates`);
});

// Listen for new batches
socket.on('batch:added', (data) => {
  console.log('New batch added:', data.batch);
});

// Listen for job status changes
socket.on('job:status_changed', (data) => {
  console.log(`Job ${data.jobId} status: ${data.status}`);
});

// Handle disconnection
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

### Angular Service Example

```typescript
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;

  constructor() {
    this.socket = io('ws://localhost:3001');
  }

  // Subscribe to batch updates
  subscribeToBatches(): Observable<any> {
    this.socket.emit('subscribe:batches');
    return new Observable(observer => {
      this.socket.on('batch:added', data => observer.next(data));
    });
  }

  // Subscribe to job updates
  subscribeToJobs(): Observable<any> {
    this.socket.emit('subscribe:jobs');
    return new Observable(observer => {
      this.socket.on('job:status_changed', data => observer.next(data));
    });
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket.connected;
  }

  // Disconnect
  disconnect(): void {
    this.socket.disconnect();
  }
}
```

## API Endpoints

### GET /api/subscribe
Returns Socket.IO connection information and available events.

### GET /api/subscribe/stats
Returns current connection statistics.

### POST /api/subscribe/test
Test endpoint for manually triggering events (development only).

## Room-based Subscriptions

The server uses Socket.IO rooms to manage subscriptions:

- **batches**: Clients subscribed to batch events
- **jobs**: Clients subscribed to job events  
- **solutions**: Clients subscribed to solution events

Clients can subscribe/unsubscribe from specific event types independently.
