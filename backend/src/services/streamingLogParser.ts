import fs from 'fs';
import path from 'path';
import readline from 'readline';
import {config} from '../config';
import {Batch, Solution} from '../types';

// Types for filtering and aggregation (keeping existing types)
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

// Regular expressions (keeping existing)
const BATCH_SUMMARY_REGEX = /^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s+(.*)$/;
const SOLUTION_REGEX = /Found\s+(\d+)\s+cubes\s+of\s+primes/i;
const PARAMETER_REGEX = /\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/;
const RUN_FILE_REGEX = /^run_(.+)\.log$/;

/**
 * Async generator for streaming batches with backpressure support
 * This version uses directory listing instead of summary.log
 * 
 * Key improvements:
 * 1. No dependency on summary.log - finds log files directly from the directory
 * 2. Uses bottom-up parsing to extract accurate information from each log file
 * 3. Sorts log files by modification time to show newest batches first
 * 4. Extracts additional information like mode and thread count
 * 
 * The function yields Batch objects one at a time, allowing for efficient streaming
 * with backpressure support (the consumer controls the pace of processing).
 */
export async function* streamBatchesGenerator(
  filterOptions: FilterOptions = {},
  aggregationOptions: AggregationOptions = {}
): AsyncGenerator<Batch> {
  try {
    // Check if logs directory exists
    try {
      await fs.promises.access(config.logsPath);
    } catch (error) {
      console.log('Logs directory does not exist, returning empty stream');
      return;
    }

    // Get all log files from the directory
    const logFiles = await fs.promises.readdir(config.logsPath);
    const runLogFiles = logFiles.filter(file => file.match(RUN_FILE_REGEX));
    
    if (runLogFiles.length === 0) {
      console.log('No log files found in the directory');
      return;
    }

    let processedCount = 0;
    let yieldedCount = 0;

    // Sort log files by modification time (newest first)
    const logFilesWithStats = await Promise.all(
      runLogFiles.map(async (file) => {
        const filePath = path.join(config.logsPath, file);
        const stats = await fs.promises.stat(filePath);
        return { file, stats };
      })
    );
    
    logFilesWithStats.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
    
    // Process each log file
    for (const { file } of logFilesWithStats) {
      // Handle limit
      if (aggregationOptions.limit && yieldedCount >= aggregationOptions.limit) {
        break;
      }

      const filePath = path.join(config.logsPath, file);
      const aRange = file.match(RUN_FILE_REGEX)?.[1];
      
      if (!aRange) continue;
      
      // Skip if batch range filter is specified and doesn't match
      if (filterOptions.batchRange && aRange !== filterOptions.batchRange) {
        continue;
      }

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

      // Apply filters
      if (!shouldIncludeBatch(batch, filterOptions)) continue;

      // Handle offset
      if (aggregationOptions.offset && processedCount < aggregationOptions.offset) {
        processedCount++;
        continue;
      }

      processedCount++;
      yieldedCount++;
      yield batch;
    }
  } catch (error) {
    console.error('Error streaming batches:', error);
    throw error;
  }
}

/**
 * Async generator for streaming solutions with backpressure support
 * This version uses the bottom-up parsing approach
 * 
 * Key improvements:
 * 1. Extracts solutions directly from log files using bottom-up parsing
 * 2. Sorts log files by modification time to show newest solutions first
 * 3. Creates complete solution objects with calculated properties:
 *    - Cube value (a³ + b³ + c³ + d³)
 *    - Sorted parameters for easier comparison
 *    - Duplicate count and uniqueness flag
 * 
 * The function yields Solution objects one at a time, allowing for efficient streaming
 * with backpressure support (the consumer controls the pace of processing).
 */
export async function* streamSolutionsGenerator(
  filterOptions: FilterOptions = {},
  aggregationOptions: AggregationOptions = {}
): AsyncGenerator<Solution> {
  try {
    // Check if logs directory exists
    try {
      await fs.promises.access(config.logsPath);
    } catch (error) {
      console.log('Logs directory does not exist, returning empty stream');
      return;
    }

    // Get all log files from the directory
    const logFiles = await fs.promises.readdir(config.logsPath);
    const runLogFiles = logFiles.filter(file => file.match(RUN_FILE_REGEX));
    
    if (runLogFiles.length === 0) {
      console.log('No log files found in the directory');
      return;
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

    let processedCount = 0;
    let yieldedCount = 0;

    for (const { file: logFile } of logFilesWithStats) {
      // Handle limit across all files
      if (aggregationOptions.limit && yieldedCount >= aggregationOptions.limit) {
        break;
      }

      const filePath = path.join(config.logsPath, logFile);
      const batchId = logFile.replace('.log', '');

      // Skip if batch range filter is specified and doesn't match
      if (filterOptions.batchRange) {
        const aRange = logFile.match(RUN_FILE_REGEX)?.[1];
        if (aRange !== filterOptions.batchRange) {
          continue;
        }
      }

      // Parse log file to extract all information
      const logInfo = await parseLogFileFromBottom(filePath);
      if (!logInfo) continue;
      
      // Process each solution from the parsed log info
      for (const solutionParams of logInfo.solutions) {
        // Create solution object
        const params = solutionParams;
        const cubeValue = Math.pow(params.a, 3) + Math.pow(params.b, 3) + Math.pow(params.c, 3) + Math.pow(params.d, 3);
        const sortedParams = [params.a, params.b, params.c, params.d].sort((x, y) => x - y);
        const duplicateCount = countDuplicateParams(params);
        
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
        
        if (!shouldIncludeSolution(solution, filterOptions)) continue;

        // Handle offset
        if (aggregationOptions.offset && processedCount < aggregationOptions.offset) {
          processedCount++;
          continue;
        }

        // Handle limit
        if (aggregationOptions.limit && yieldedCount >= aggregationOptions.limit) {
          return;
        }

        processedCount++;
        yieldedCount++;
        yield solution;
      }
    }
  } catch (error) {
    console.error('Error streaming solutions:', error);
    throw error;
  }
}

// Helper functions (keeping existing logic)
async function parseBatchLine(line: string): Promise<Batch | null> {
  const match = line.match(BATCH_SUMMARY_REGEX);
  if (!match) return null;

  const [, dateStr, timeStr, summary] = match;

  const aRangeMatch = summary.match(/a_range=(\S+)/);
  const checkedMatch = summary.match(/checked=(\d+)/);
  const foundMatch = summary.match(/found=(\d+)/);
  const elapsedMatch = summary.match(/elapsed=([\d.]+)s/);
  const rpsMatch = summary.match(/rps=(\d+)/);

  if (!aRangeMatch) return null;

  const aRange = aRangeMatch[1];
  const logFile = `run_${aRange}.log`;
  const logFilePath = path.join(config.logsPath, logFile);

  // Get actual found count from log file if it exists
  let actualFoundCount: number | undefined = foundMatch ? parseInt(foundMatch[1], 10) : undefined;
  
  try {
    // Check if log file exists
    await fs.promises.access(logFilePath);
    
    // Use the simple approach to find solution count
    actualFoundCount = await findSolutionFromBottomSimple(logFilePath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`Could not read log file ${logFile}: ${errorMessage}`);
    // Fall back to the found count from the summary line
  }

  let timestamp = new Date(dateStr);
  if (timeStr) {
    timestamp = new Date(`${dateStr}T${timeStr}:00`);
  }

  return {
    id: `batch_${aRange}_${Date.now()}`,
    timestamp,
    status: 'completed',
    startTime: timestamp,
    endTime: timestamp,
    duration: elapsedMatch ? parseFloat(elapsedMatch[1]) : undefined,
    parameters: {
      aRange,
      checked: checkedMatch ? parseInt(checkedMatch[1], 10) : undefined,
      found: actualFoundCount,
      rps: rpsMatch ? parseInt(rpsMatch[1], 10) : undefined,
    },
    logFile,
    summary: summary.trim(),
  };
}

function shouldIncludeBatch(batch: Batch, options: FilterOptions): boolean {
  // Date range filter
  if (options.dateFrom && batch.timestamp < options.dateFrom) {
    return false;
  }
  if (options.dateTo && batch.timestamp > options.dateTo) {
    return false;
  }

  // Batch range filter
  if (options.batchRange && batch.parameters?.aRange !== options.batchRange) {
    return false;
  }

  return true;
}


// Helper function to count duplicate parameters
function countDuplicateParams(params: {a: number, b: number, c: number, d: number}): number {
  const values = [params.a, params.b, params.c, params.d];
  const uniqueValues = new Set(values);
  return values.length - uniqueValues.size;
}

function parseSolutionLine(line: string, lineNumber: number, allLines: string[], logFile: string, batchId: string): Solution[] {
  const solutionMatch = line.match(SOLUTION_REGEX);
  if (!solutionMatch) return [];

  const cubesCount = parseInt(solutionMatch[1], 10);

  // Extract parameters from preceding lines
  const parameterLines: string[] = [];
  const startLine = Math.max(0, lineNumber - 50);
  
  for (let j = startLine; j < lineNumber; j++) {
    const prevLine = allLines[j];
    if (prevLine && prevLine.match(PARAMETER_REGEX)) {
      parameterLines.push(prevLine.trim());
    }
  }

  // Create solutions for each parameter combination found
  const solutions: Solution[] = [];
  
  if (parameterLines.length > 0) {
    for (let k = 0; k < parameterLines.length; k++) {
      const paramMatch = parameterLines[k].match(PARAMETER_REGEX);
      if (paramMatch) {
        const [, a, b, c, d] = paramMatch;
        const params = {
          a: parseInt(a, 10),
          b: parseInt(b, 10),
          c: parseInt(c, 10),
          d: parseInt(d, 10),
        };

        // Calculate cube value and other duplicate/unique properties
        const cubeValue = Math.pow(params.a, 3) + Math.pow(params.b, 3) + Math.pow(params.c, 3) + Math.pow(params.d, 3);
        const sortedParams = [params.a, params.b, params.c, params.d].sort((x, y) => x - y);
        const duplicateCount = countDuplicateParams(params);

        solutions.push({
          id: `solution_${batchId}_${lineNumber}_${k}_${Date.now()}`,
          batchId: batchId,
          timestamp: new Date(),
          cubesCount,
          parameterCombination: params,
          logFile,
          lineNumber,
          rawLine: `${parameterLines[k]} -> ${line.trim()}`,
          cubeValue,
          sortedParams,
          duplicateCount,
          isUnique: duplicateCount === 0
        });
      }
    }
  } else {
    // If no parameters found, add solution with default values
    const defaultParams = { a: 0, b: 0, c: 0, d: 0 };
    const cubeValue = 0; // Default case
    const sortedParams = [0, 0, 0, 0];
    const duplicateCount = 4; // All zeros are duplicates
    
    solutions.push({
      id: `solution_${batchId}_${lineNumber}_${Date.now()}`,
      batchId: batchId,
      timestamp: new Date(),
      cubesCount,
      parameterCombination: defaultParams,
      logFile,
      lineNumber,
      rawLine: line.trim(),
      cubeValue,
      sortedParams,
      duplicateCount,
      isUnique: false
    });
  }

  return solutions;
}

function shouldIncludeSolution(solution: Solution, options: FilterOptions): boolean {
  // Cubes count filter
  if (options.minCubesCount && solution.cubesCount < options.minCubesCount) {
    return false;
  }
  if (options.maxCubesCount && solution.cubesCount > options.maxCubesCount) {
    return false;
  }

  // Parameter filters
  if (options.parameterFilters) {
    const { a, b, c, d } = options.parameterFilters;
    const params = solution.parameterCombination;

    if (a?.min && params.a < a.min) return false;
    if (a?.max && params.a > a.max) return false;
    if (b?.min && params.b < b.min) return false;
    if (b?.max && params.b > b.max) return false;
    if (c?.min && params.c < c.min) return false;
    if (c?.max && params.c > c.max) return false;
    if (d?.min && params.d < d.min) return false;
    if (d?.max && params.d > d.max) return false;
  }

  return true;
}

// Legacy functions for backward compatibility (collect all in memory)
export async function streamBatches(
  filterOptions: FilterOptions = {},
  aggregationOptions: AggregationOptions = {}
): Promise<any[]> {
  const results: any[] = [];
  for await (const batch of streamBatchesGenerator(filterOptions, aggregationOptions)) {
    results.push(batch);
  }
  return results;
}

export async function streamSolutions(
  filterOptions: FilterOptions = {},
  aggregationOptions: AggregationOptions = {}
): Promise<any[]> {
  const results: any[] = [];
  for await (const solution of streamSolutionsGenerator(filterOptions, aggregationOptions)) {
    results.push(solution);
  }
  return results;
}

/**
 * Comprehensive implementation to parse log file from bottom to top
 * This extracts all relevant information including:
 * - Number of solutions found (last line)
 * - The actual solutions (parameter combinations)
 * - Throughput and performance metrics
 * - Start and end times
 * - Mode and thread count
 * 
 * This approach is more reliable than top-down parsing because:
 * 1. The last line always contains the final solution count
 * 2. Solutions are listed right before the final count
 * 3. Performance metrics are consistent and easy to extract
 * 4. We can still get the start time from the first line
 */
export interface LogFileInfo {
  solutionCount: number;
  solutions: Array<{a: number, b: number, c: number, d: number}>;
  throughput: number;
  totalCombinations: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  mode?: string;
  threads?: number;
}

export async function parseLogFileFromBottom(logFilePath: string): Promise<LogFileInfo | undefined> {
  try {
    const fileContent = await fs.promises.readFile(logFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return undefined;
    }

    // Default values
    const result: LogFileInfo = {
      solutionCount: 0,
      solutions: [],
      throughput: 0,
      totalCombinations: 0,
      duration: 0,
      startTime: new Date(),
      endTime: new Date()
    };

    // Start from the bottom
    let i = lines.length - 1;
    
    // Last line should be "Found X cubes of primes." or "No cubes of primes found in this range."
    const lastLine = lines[i];
    const solutionCountMatch = lastLine.match(/Found\s+(\d+)\s+cubes?\s+of\s+primes/i);
    if (solutionCountMatch) {
      result.solutionCount = parseInt(solutionCountMatch[1], 10);
      i--;
    } else if (lastLine.includes("No cubes of primes found in this range")) {
      // Handle the case where no solutions were found
      result.solutionCount = 0;
      i--;
    } else {
      // If not found, try to scan a few lines up
      let foundSolutionCount = false;
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        const solutionMatch = lines[j].match(/Found\s+(\d+)\s+cubes?\s+of\s+primes/i);
        if (solutionMatch) {
          result.solutionCount = parseInt(solutionMatch[1], 10);
          i = j - 1;
          foundSolutionCount = true;
          break;
        } else if (lines[j].includes("No cubes of primes found in this range")) {
          result.solutionCount = 0;
          i = j - 1;
          foundSolutionCount = true;
          break;
        }
      }
      
      if (!foundSolutionCount) {
        return undefined; // Not a valid log file or incomplete
      }
    }

    // Parse solutions (going up from the solution count line)
    while (i >= 0) {
      const line = lines[i];
      
      // Stop when we reach "Cubes of primes found:" line
      if (line.includes("Cubes of primes found:")) {
        i--;
        break;
      }
      
      // Parse solution line with format (a, b, c, d)
      const paramMatch = line.match(PARAMETER_REGEX);
      if (paramMatch) {
        const [, a, b, c, d] = paramMatch;
        result.solutions.push({
          a: parseInt(a, 10),
          b: parseInt(b, 10),
          c: parseInt(c, 10),
          d: parseInt(d, 10)
        });
      }
      
      i--;
    }

    // Continue parsing upward for throughput and completion info
    while (i >= 0) {
      const line = lines[i];
      
      // Look for throughput line
      const throughputMatch = line.match(/Throughput:\s+([\d,]+)\s+checks\/second/i);
      if (throughputMatch) {
        result.throughput = parseInt(throughputMatch[1].replace(/,/g, ''), 10);
        i--;
        continue;
      }
      
      // Look for completion line with duration
      const completionMatch = line.match(/Search completed\.\s+Checked\s+([\d,]+)\s+combinations\s+in\s+([\d.]+)\s+seconds/i);
      if (completionMatch) {
        result.totalCombinations = parseInt(completionMatch[1].replace(/,/g, ''), 10);
        result.duration = parseFloat(completionMatch[2]);
        
        // Extract end time from this line
        const timeMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
        if (timeMatch) {
          result.endTime = new Date(timeMatch[1]);
        }
        
        i--;
        continue;
      }
      
      // Look for mode and threads
      const modeMatch = line.match(/Mode:\s+(\w+)/i);
      if (modeMatch) {
        result.mode = modeMatch[1];
        i--;
        continue;
      }
      
      const threadsMatch = line.match(/Threads:\s+(\d+)/i);
      if (threadsMatch) {
        result.threads = parseInt(threadsMatch[1], 10);
        i--;
        continue;
      }
      
      // Look for starting line with parameters
      const startMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+Starting\s+search/i);
      if (startMatch) {
        result.startTime = new Date(startMatch[1]);
        break; // We've reached the start of the log
      }
      
      i--;
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing log file:', error);
    return undefined;
  }
}

// Simple implementation to find solution count from log file (kept for backward compatibility)
async function findSolutionFromBottomSimple(logFilePath: string): Promise<number | undefined> {
  try {
    const logInfo = await parseLogFileFromBottom(logFilePath);
    return logInfo?.solutionCount;
  } catch (error) {
    return undefined;
  }
}

