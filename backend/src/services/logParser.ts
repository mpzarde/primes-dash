import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { config } from '../config';
import { Batch, Solution, LogWatcherOptions } from '../types';
import { getSocketService } from './socketService';

// Regular expressions for parsing log files
const BATCH_SUMMARY_REGEX = /^(\d{4}-\d{2}-\d{2})\s+(.*)$/;
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

  const [, dateStr, summary] = match;

  // Parse the summary line to extract information
  // Format: "2025-07-01 a_range=1-50 checked=50000000000000 found=22 elapsed=15450.45s rps=3236151232"
  const aRangeMatch = summary.match(/a_range=(\S+)/);
  const checkedMatch = summary.match(/checked=(\d+)/);
  const foundMatch = summary.match(/found=(\d+)/);
  const elapsedMatch = summary.match(/elapsed=([\d.]+)s/);
  const rpsMatch = summary.match(/rps=(\d+)/);

  if (!aRangeMatch) return null;

  const aRange = aRangeMatch[1];
  const logFile = `run_${aRange}.log`;

  // Get the file modification time to use as the timestamp
  let timestamp = new Date(dateStr);
  try {
    const logFilePath = path.join(config.logsPath, logFile);
    const stats = await fs.stat(logFilePath);
    timestamp = stats.mtime;
  } catch (error) {
    console.warn(`Could not get modification time for ${logFile}, using date from summary.log`);
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
 * Read and parse summary.log file
 */
async function parseSummaryLog(): Promise<Batch[]> {
  try {
    const summaryPath = path.join(config.logsPath, 'summary.log');
    const content = await fs.readFile(summaryPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const batchPromises: Promise<Batch | null>[] = [];

    for (let i = 0; i < lines.length; i++) {
      batchPromises.push(parseBatchLine(lines[i], i + 1));
    }

    const batchResults = await Promise.all(batchPromises);
    const batches = batchResults.filter((batch): batch is Batch => batch !== null);

    return batches;
  } catch (error) {
    console.error('Error reading summary.log:', error);
    return [];
  }
}

/**
 * Scan individual run_*.log files for solutions
 */
async function scanRunLogFiles(): Promise<Solution[]> {
  try {
    const logFiles = await fs.readdir(config.logsPath);
    const runLogFiles = logFiles.filter(file => file.match(RUN_FILE_REGEX));

    const solutions: Solution[] = [];

    for (const logFile of runLogFiles) {
      const filePath = path.join(config.logsPath, logFile);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Generate batch ID from log file name
      const batchId = logFile.replace('.log', '');

      for (let i = 0; i < lines.length; i++) {
        const solution = parseSolutionLine(lines[i], i + 1, logFile, batchId);
        if (solution) {
          // Extract parameters from lines preceding the "Found X cubes" line
          const parameterLines: string[] = [];

          // Look back up to 50 lines for parameter combinations
          const startLine = Math.max(0, i - 50);
          for (let j = startLine; j < i; j++) {
            const line = lines[j];
            if (line.match(PARAMETER_REGEX)) {
              parameterLines.push(line.trim());
            }
          }

          // Store all parameter combinations found before this solution
          (solution as any).parameterLines = parameterLines;

          // If we have parameter lines, we can create multiple solutions for each parameter combination
          if (parameterLines.length > 0) {
            for (let k = 0; k < parameterLines.length; k++) {
              const paramMatch = parameterLines[k].match(PARAMETER_REGEX);
              if (paramMatch) {
                const [, a, b, c, d] = paramMatch;
                const paramSolution: Solution = {
                  ...solution,
                  id: `solution_${batchId}_${i + 1}_${k}_${Date.now()}`,
                  parameterCombination: {
                    a: parseInt(a, 10),
                    b: parseInt(b, 10),
                    c: parseInt(c, 10),
                    d: parseInt(d, 10),
                  },
                  rawLine: `${parameterLines[k]} -> ${solution.rawLine}`,
                };
                solutions.push(paramSolution);
              }
            }
          } else {
            // If no parameters found, add the solution as-is
            solutions.push(solution);
          }
        }
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
