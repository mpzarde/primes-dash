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
  cubeValue?: number;
  sortedParams?: number[];
  duplicateCount?: number;
  isUnique?: boolean;
}

export interface LogWatcherOptions {
  watchForNewFiles?: boolean;
  watchDelay?: number; // in milliseconds
}

// Streaming and filtering types
export interface FilterOptions {
  dateFrom?: Date;
  dateTo?: Date;
  logLevel?: string;
  batchRange?: string;
  minCubesCount?: number;
  maxCubesCount?: number;
  parameterFilters?: {
    a?: { min?: number; max?: number };
    b?: { min?: number; max?: number };
    c?: { min?: number; max?: number };
    d?: { min?: number; max?: number };
  };
}

export interface AggregationOptions {
  groupBy?: 'date' | 'batchRange' | 'logLevel' | 'parameterRange';
  aggregateFields?: Array<'count' | 'cubesSum' | 'avgDuration' | 'avgRps'>;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
