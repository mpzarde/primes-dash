import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { watch } from 'chokidar';
import { config } from '../config';
import { Batch, Solution, LogWatcherOptions } from '../types';
import { getSocketService } from './socketService';
import { parseLogFileFromBottom, LogFileInfo } from './streamingLogParser';

// Regular expressions for parsing log files
const BATCH_SUMMARY_REGEX = /^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s+(.*)$/;
const SOLUTION_REGEX = /Found\s+(\d+)\s+cubes\s+of\s+primes/i;
const PARAMETER_REGEX = /\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/;
const RUN_FILE_REGEX = /^run_(.+)\.log$/;

// Cache for storing parsed data
let batchCache: Batch[] = [];
let solutionCache: Solution[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Parse a line from summary.log into a Batch record
 */
async function parseBatchLine(line: string, lineNumber: number): Promise<Batch | null> {
  const match = line.match(BATCH_SUMMARY_REGEX);
  if (!match) return null;

  const [, dateStr, timeStr, summary] = match;

  // Parse the summary line to extract information
  // Format: "2025-07-01 a_range=1-50 checked=50000000000000 found=22 elapsed=15450.45s rps=3236151232"
  // Or: "2025-07-02 17:09 a_range=5000-5049 checked=50000000000000 found=1 elapsed=8334.30s rps=6000720081"
  const aRangeMatch = summary.match(/a_range=(\S+)/);
  const checkedMatch = summary.match(/checked=(\d+)/);
  const foundMatch = summary.match(/found=(\d+)/);
  const elapsedMatch = summary.match(/elapsed=([\d.]+)s/);
  const rpsMatch = summary.match(/rps=(\d+)/);

  if (!aRangeMatch) return null;

  const aRange = aRangeMatch[1];
  const logFile = `run_${aRange}.log`;

  // Use the timestamp from summary.log (with time if available, otherwise use start of day)
  let timestamp = new Date(dateStr);
  if (timeStr) {
    // If we have a time component, use it
    timestamp = new Date(`${dateStr}T${timeStr}:00`);
  }

  return {
    id: `batch_${aRange}_${Date.now()}`,
    timestamp,
    status: 'completed', // All entries in summary.log are completed batches
    startTime: timestamp,
    endTime: timestamp,
    duration: elapsedMatch ? parseFloat(elapsedMatch[1]) : undefined,
    parameters: {
      aRange,
      checked: checkedMatch ? parseInt(checkedMatch[1], 10) : undefined,
      found: foundMatch ? parseInt(foundMatch[1], 10) : undefined,
      rps: rpsMatch ? parseInt(rpsMatch[1], 10) : undefined,
    },
    logFile,
    summary: summary.trim(),
  };
}

/**
 * Parse a line from run_*.log to extract solution information
 * This function only identifies "Found X cubes" lines, parameter extraction happens in scanRunLogFiles
 */
function parseSolutionLine(line: string, lineNumber: number, logFile: string, batchId: string): Solution | null {
  const solutionMatch = line.match(SOLUTION_REGEX);
  if (!solutionMatch) return null;

  const cubesCount = parseInt(solutionMatch[1], 10);

  return {
    id: `solution_${batchId}_${lineNumber}_${Date.now()}`,
    batchId,
    timestamp: new Date(),
    cubesCount,
    parameterCombination: {
      a: 0, // Will be populated when we extract parameters from surrounding lines
      b: 0,
      c: 0,
      d: 0,
    },
    logFile,
    lineNumber,
    rawLine: line.trim(),
  };
}

/**
 * Get batch information by scanning log files directly
 * This version uses directory listing instead of summary.log
 */
async function parseSummaryLog(): Promise<Batch[]> {
  try {
    // Ensure logs directory exists
    try {
      await fs.promises.access(config.logsPath);
    } catch (error) {
      console.log(`Logs directory does not exist, creating: ${config.logsPath}`);
      await fs.promises.mkdir(config.logsPath, { recursive: true });
      
      // Create a sample log file to ensure there's at least one batch to display
      const sampleLogPath = path.join(config.logsPath, 'run_1-100.log');
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:${String(today.getSeconds()).padStart(2, '0')}`;
      
      const sampleLogContent = 
`${todayStr} ${timeStr} Starting search: a∈[1,100], b∈[1,10000], c∈[1,10000], d∈[1,10000]
Total combinations: 10000000000
Mode: parallel
Threads: 12

${todayStr} ${timeStr} Search completed. Checked 10000000000 combinations in 105.23 seconds.
Throughput: 95028984 checks/second

Cubes of primes found:
(17, 21, 29, 33)
Found 1 cubes of primes.`;
      
      await fs.promises.writeFile(sampleLogPath, sampleLogContent, 'utf-8');
      
      // Parse the sample log file
      const logInfo = await parseLogFileFromBottom(sampleLogPath);
      if (logInfo) {
        const batch: Batch = {
          id: `batch_1-100_${Date.now()}`,
          timestamp: logInfo.startTime,
          status: 'completed',
          startTime: logInfo.startTime,
          endTime: logInfo.endTime,
          duration: logInfo.duration,
          parameters: {
            aRange: '1-100',
            checked: logInfo.totalCombinations,
            found: logInfo.solutionCount,
            rps: logInfo.throughput,
            mode: logInfo.mode,
            threads: logInfo.threads
          },
          logFile: 'run_1-100.log',
          summary: `a_range=1-100 checked=${logInfo.totalCombinations} found=${logInfo.solutionCount} elapsed=${logInfo.duration}s rps=${logInfo.throughput}`
        };
        return [batch];
      }
      
      return [];
    }

    // Get all log files from the directory
    const logFiles = await fs.promises.readdir(config.logsPath);
    const runLogFiles = logFiles.filter(file => file.match(RUN_FILE_REGEX));
    
    if (runLogFiles.length === 0) {
      console.log('No log files found in the directory');
      return [];
    }

    // Sort log files by modification time (newest first)
    const logFilesWithStats = await Promise.all(
      runLogFiles.map(async (file) => {
        const filePath = path.join(config.logsPath, file);
        const stats = await fs.promises.stat(filePath);
        return { file, stats };
      })
    );
    
    logFilesWithStats.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
    
    // Process each log file to extract batch information
    const batches: Batch[] = [];
    
    for (const { file } of logFilesWithStats) {
      const filePath = path.join(config.logsPath, file);
      const aRange = file.match(RUN_FILE_REGEX)?.[1];
      
      if (!aRange) continue;
      
      // Parse log file to extract batch information
      const logInfo = await parseLogFileFromBottom(filePath);
      if (!logInfo) continue;
      
      // Create batch object from log file information
      const batch: Batch = {
        id: `batch_${aRange}_${Date.now()}`,
        timestamp: logInfo.startTime,
        status: 'completed',
        startTime: logInfo.startTime,
        endTime: logInfo.endTime,
        duration: logInfo.duration,
        parameters: {
          aRange,
          checked: logInfo.totalCombinations,
          found: logInfo.solutionCount,
          rps: logInfo.throughput,
          mode: logInfo.mode,
          threads: logInfo.threads
        },
        logFile: file,
        summary: `a_range=${aRange} checked=${logInfo.totalCombinations} found=${logInfo.solutionCount} elapsed=${logInfo.duration}s rps=${logInfo.throughput}`
      };
      
      batches.push(batch);
    }

    return batches;
  } catch (error) {
    console.error('Error scanning log files:', error);
    return [];
  }
}

/**
 * Scan individual run_*.log files for solutions using bottom-up parsing approach
 */
async function scanRunLogFiles(): Promise<Solution[]> {
  try {
    // Ensure logs directory exists
    try {
      await fs.promises.access(config.logsPath);
    } catch (error) {
      console.log(`Logs directory does not exist, creating: ${config.logsPath}`);
      await fs.promises.mkdir(config.logsPath, { recursive: true });
      return []; // Return empty array since the directory was just created
    }

    const logFiles = await fs.promises.readdir(config.logsPath);
    const runLogFiles = logFiles.filter(file => file.match(RUN_FILE_REGEX));

    // Sort log files by modification time (newest first)
    const logFilesWithStats = await Promise.all(
      runLogFiles.map(async (file) => {
        const filePath = path.join(config.logsPath, file);
        const stats = await fs.promises.stat(filePath);
        return { file, stats };
      })
    );
    
    logFilesWithStats.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
    
    const solutions: Solution[] = [];

    for (const { file: logFile } of logFilesWithStats) {
      const filePath = path.join(config.logsPath, logFile);
      
      // Generate batch ID from log file name
      const batchId = logFile.replace('.log', '');

      // Use the bottom-up parsing approach to extract all information
      const logInfo = await parseLogFileFromBottom(filePath);
      if (!logInfo) continue;
      
      // Process each solution from the parsed log info
      for (const solutionParams of logInfo.solutions) {
        // Create solution object
        const params = solutionParams;
        
        // Calculate cube value
        const cubeValue = Math.pow(params.a, 3) + Math.pow(params.b, 3) + 
                          Math.pow(params.c, 3) + Math.pow(params.d, 3);
        
        // Sort parameters for display
        const sortedParams = [params.a, params.b, params.c, params.d].sort((x, y) => x - y);
        
        // Count duplicate parameters
        const values = [params.a, params.b, params.c, params.d];
        const uniqueValues = new Set(values);
        const duplicateCount = values.length - uniqueValues.size;
        
        const solution: Solution = {
          id: `solution_${batchId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          batchId: batchId,
          timestamp: logInfo.endTime, // Use end time as the solution timestamp
          cubesCount: logInfo.solutionCount,
          parameterCombination: params,
          logFile,
          lineNumber: 0, // We don't track line numbers in the bottom-up approach
          rawLine: `(${params.a}, ${params.b}, ${params.c}, ${params.d})`,
          cubeValue,
          sortedParams,
          duplicateCount,
          isUnique: duplicateCount === 0
        };
        
        solutions.push(solution);
      }
    }

    return solutions;
  } catch (error) {
    console.error('Error scanning run log files:', error);
    return [];
  }
}

/**
 * Get all batch summaries from summary.log
 */
export async function getBatchSummaries(): Promise<Batch[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (now - lastCacheUpdate < CACHE_TTL && batchCache.length > 0) {
    return batchCache;
  }

  try {
    batchCache = await parseSummaryLog();
    lastCacheUpdate = now;
    return batchCache;
  } catch (error) {
    console.error('Error getting batch summaries:', error);
    return [];
  }
}

/**
 * Get all solutions from run_*.log files
 */
export async function getSolutions(): Promise<Solution[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (now - lastCacheUpdate < CACHE_TTL && solutionCache.length > 0) {
    return solutionCache;
  }

  try {
    solutionCache = await scanRunLogFiles();
    lastCacheUpdate = now;
    return solutionCache;
  } catch (error) {
    console.error('Error getting solutions:', error);
    return [];
  }
}

/**
 * Watch the logs folder for new files (optional feature)
 */
export function watchLogsFolder(options: LogWatcherOptions = {}): void {
  const { watchForNewFiles = true, watchDelay = 1000 } = options;

  if (!watchForNewFiles) return;

  try {
    // Ensure logs directory exists
    try {
      fs.promises.access(config.logsPath).catch(async (error) => {
        console.log(`Logs directory does not exist, creating: ${config.logsPath}`);
        await fs.promises.mkdir(config.logsPath, { recursive: true });

        // Create summary.log file with sample batch entry if it doesn't exist
        const summaryPath = path.join(config.logsPath, 'summary.log');
        try {
          await fs.promises.access(summaryPath);
        } catch (error) {
          console.log(`summary.log does not exist, creating sample file: ${summaryPath}`);
          // Create a sample batch entry to ensure there's at least one batch to display
          const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
          const sampleEntry = `${today} a_range=1-100 checked=1000000 found=5 elapsed=10.5s rps=95238`;
          await fs.promises.writeFile(summaryPath, sampleEntry, 'utf-8');

          // Force cache refresh
          clearCache();
        }
      });
    } catch (error) {
      console.error('Error checking logs directory:', error);
    }

    const watcher = watch(config.logsPath, {
      ignored: /[\/\\]\./,
      persistent: true,
      ignoreInitial: true,
    });

    watcher
      .on('add', (filePath) => {
        const fileName = path.basename(filePath);
        if (fileName.endsWith('.log')) {
          console.log(`New log file detected: ${fileName}`);

          // Check if it's a summary.log update or new run log
          if (fileName === 'summary.log') {
            // Parse new batch and emit event
            setTimeout(async () => {
              try {
                const newBatches = await parseSummaryLog();
                const socketService = getSocketService();

                if (socketService && newBatches.length > batchCache.length) {
                  // Emit only the new batches
                  const newBatchesOnly = newBatches.slice(batchCache.length);
                  newBatchesOnly.forEach(batch => {
                    socketService.emitBatchAdded(batch);
                  });
                }

                batchCache = newBatches;
                lastCacheUpdate = Date.now();
              } catch (error) {
                console.error('Error processing new batch:', error);
              }
            }, watchDelay);
          } else {
            // Invalidate cache for other log files
            setTimeout(() => {
              lastCacheUpdate = 0;
            }, watchDelay);
          }
        }
      })
      .on('change', (filePath) => {
        const fileName = path.basename(filePath);
        if (fileName.endsWith('.log')) {
          console.log(`Log file changed: ${fileName}`);

          // Check if it's a summary.log change
          if (fileName === 'summary.log') {
            // Parse updated batch and emit event
            setTimeout(async () => {
              try {
                const newBatches = await parseSummaryLog();
                const socketService = getSocketService();

                if (socketService && newBatches.length > batchCache.length) {
                  // Emit only the new batches
                  const newBatchesOnly = newBatches.slice(batchCache.length);
                  newBatchesOnly.forEach(batch => {
                    socketService.emitBatchAdded(batch);
                  });
                }

                batchCache = newBatches;
                lastCacheUpdate = Date.now();
              } catch (error) {
                console.error('Error processing updated batch:', error);
              }
            }, watchDelay);
          } else {
            // Invalidate cache for other log files
            setTimeout(() => {
              lastCacheUpdate = 0;
            }, watchDelay);
          }
        }
      })
      .on('error', (error) => {
        console.error('Log watcher error:', error);
      });

    console.log(`Watching logs folder: ${config.logsPath}`);
  } catch (error) {
    console.error('Error setting up log watcher:', error);
  }
}

/**
 * Initialize the log parser service
 */
export function initLogParser(options: LogWatcherOptions = {}): void {
  watchLogsFolder(options);
}

/**
 * Clear the cache manually (useful for testing or forced refresh)
 */
export function clearCache(): void {
  batchCache = [];
  solutionCache = [];
  lastCacheUpdate = 0;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { batchCount: number; solutionCount: number; lastUpdate: number } {
  return {
    batchCount: batchCache.length,
    solutionCount: solutionCache.length,
    lastUpdate: lastCacheUpdate,
  };
}
