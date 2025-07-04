export interface Batch {
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

export interface Solution {
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

export interface LogWatcherOptions {
  watchForNewFiles?: boolean;
  watchDelay?: number; // in milliseconds
}
