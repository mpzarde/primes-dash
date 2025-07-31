import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Transform, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { config } from '../config';
import { Batch, Solution } from '../types';

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
 */
export async function* streamBatchesGenerator(
  filterOptions: FilterOptions = {},
  aggregationOptions: AggregationOptions = {}
): AsyncGenerator<Batch> {
  try {
    const summaryPath = path.join(config.logsPath, 'summary.log');
    
    // Check if file exists
    try {
      await fs.promises.access(summaryPath);
    } catch (error) {
      console.log('summary.log does not exist, returning empty stream');
      return;
    }

    const readStream = fs.createReadStream(summaryPath, 'utf-8');
    const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
    
    let processedCount = 0;
    let yieldedCount = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;

      const batch = parseBatchLine(line);
      if (!batch) continue;

      // Apply filters
      if (!shouldIncludeBatch(batch, filterOptions)) continue;

      // Handle offset
      if (aggregationOptions.offset && processedCount < aggregationOptions.offset) {
        processedCount++;
        continue;
      }

      // Handle limit
      if (aggregationOptions.limit && yieldedCount >= aggregationOptions.limit) {
        break;
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

    const logFiles = await fs.promises.readdir(config.logsPath);
    const runLogFiles = logFiles.filter(file => file.match(RUN_FILE_REGEX));

    let processedCount = 0;
    let yieldedCount = 0;

    for (const logFile of runLogFiles) {
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

      // Read and process file line by line
      const readStream = fs.createReadStream(filePath, 'utf-8');
      const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
      
      // We need to read all lines first for parameter extraction
      const allLines: string[] = [];
      for await (const line of rl) {
        allLines.push(line);
      }

      // Process each line for solutions
      for (let lineNumber = 0; lineNumber < allLines.length; lineNumber++) {
        const line = allLines[lineNumber];
        const solutions = parseSolutionLine(line, lineNumber, allLines, logFile, batchId);
        
        for (const solution of solutions) {
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
    }
  } catch (error) {
    console.error('Error streaming solutions:', error);
    throw error;
  }
}

// Helper functions (keeping existing logic)
function parseBatchLine(line: string): Batch | null {
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
      found: foundMatch ? parseInt(foundMatch[1], 10) : undefined,
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
