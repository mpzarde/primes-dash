# Log Parser Service

This service provides functions to parse log files from the prime cubes computation project.

## Features

- **Parse Summary Logs**: Reads `summary.log` and parses lines into batch records
- **Extract Solutions**: Scans individual `run_*.log` files to extract solution data
- **Parameter Extraction**: Uses regex to match solution lines and extract parameter combinations
- **File Watching**: Optional real-time monitoring of the logs directory for new files
- **Caching**: Built-in caching with configurable TTL for performance

## API

### Main Functions

```typescript
// Get all batch summaries from summary.log
async function getBatchSummaries(): Promise<Batch[]>

// Get all solutions from run_*.log files
async function getSolutions(): Promise<Solution[]>

// Initialize the log parser with optional file watching
function initLogParser(options?: LogWatcherOptions): void

// Start watching the logs folder for changes
function watchLogsFolder(options?: LogWatcherOptions): void

// Clear the cache manually
function clearCache(): void

// Get cache statistics
function getCacheStats(): { batchCount: number; solutionCount: number; lastUpdate: number }
```

### Types

```typescript
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

interface LogWatcherOptions {
  watchForNewFiles?: boolean;
  watchDelay?: number; // in milliseconds
}
```

## Configuration

The service uses environment variables for configuration:

- `LOGS_PATH`: Path to the logs directory (default: `/Users/mpzarde/projects/prime-cubes/logs`)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (default: development)

## Log File Formats

### summary.log
```
2025-07-01 a_range=1-50 checked=50000000000000 found=22 elapsed=15450.45s rps=3236151232
2025-07-02 a_range=51-100 checked=50000000000000 found=13 elapsed=15450.45s rps=3236151232
```

### run_*.log
```
2025-07-01 11:58:21 Starting search: a∈[1,50], b∈[1,10000], c∈[1,10000], d∈[1,10000]
...
(7, 150, 150, 150)
(7, 2760, 2760, 2760)
...
Found 22 cubes of primes.
```

## Usage Example

```typescript
import { getBatchSummaries, getSolutions, initLogParser } from './src';

// Initialize with file watching
initLogParser({ watchForNewFiles: true });

// Get batch data
const batches = await getBatchSummaries();
console.log(`Found ${batches.length} batches`);

// Get solution data
const solutions = await getSolutions();
console.log(`Found ${solutions.length} solutions`);
```

## Testing

Run the test scripts to verify functionality:

```bash
# Test basic parsing functionality
npx ts-node src/test-logparser.ts

# Test file watching functionality
npx ts-node src/test-watcher.ts
```

## Performance

- Caching is enabled by default with a 30-second TTL
- File watching uses chokidar for efficient monitoring
- Large log files are processed in chunks to avoid memory issues
- Parameter extraction looks back up to 50 lines for efficiency
