import { Router, Request, Response } from 'express';
import { streamSolutionsGenerator, FilterOptions, AggregationOptions } from '../services/streamingLogParser';
import { StreamingResponseWriter, CSVStreamingResponseWriter, createStreamFromAsyncGenerator } from '../utils/streamingResponse';
import { getCurrentTimestampWithoutTimezone } from '../utils/dateUtils';
import { pipeline } from 'stream/promises';

const router = Router();

/**
 * GET /api/solutions
 * Returns all solutions with batch metadata using true streaming with backpressure handling
 * Query parameters:
 *   - batchRange: Filter solutions by batch range
 *   - dateFrom/startDate: Start date for filtering (ISO string)
 *   - dateTo/endDate: End date for filtering (ISO string)
 *   - minCubesCount: Minimum number of cubes
 *   - maxCubesCount: Maximum number of cubes
 *   - aMin, aMax, bMin, bMax, cMin, cMax, dMin, dMax: Parameter range filters
 *   - limit: Maximum number of results to return
 *   - offset: Number of results to skip
 *   - page: Page number (alternative to offset, starts from 1)
 *   - sortBy: Field to sort by
 *   - sortOrder: 'asc' or 'desc'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('Streaming solutions with backpressure...');
    
    // Parse filter options
    const filterOptions: FilterOptions = {};
    
    if (req.query.batchRange) {
      filterOptions.batchRange = req.query.batchRange as string;
    }
    const startDate = req.query.dateFrom || req.query.startDate;
    const endDate = req.query.dateTo || req.query.endDate;
    
    if (startDate) {
      filterOptions.dateFrom = new Date(startDate as string);
    }
    if (endDate) {
      filterOptions.dateTo = new Date(endDate as string);
    }
    if (req.query.minCubesCount) {
      filterOptions.minCubesCount = parseInt(req.query.minCubesCount as string, 10);
    }
    if (req.query.maxCubesCount) {
      filterOptions.maxCubesCount = parseInt(req.query.maxCubesCount as string, 10);
    }

    // Parameter filters
    const parameterFilters: any = {};
    if (req.query.aMin || req.query.aMax) {
      parameterFilters.a = {};
      if (req.query.aMin) parameterFilters.a.min = parseInt(req.query.aMin as string, 10);
      if (req.query.aMax) parameterFilters.a.max = parseInt(req.query.aMax as string, 10);
    }
    if (req.query.bMin || req.query.bMax) {
      parameterFilters.b = {};
      if (req.query.bMin) parameterFilters.b.min = parseInt(req.query.bMin as string, 10);
      if (req.query.bMax) parameterFilters.b.max = parseInt(req.query.bMax as string, 10);
    }
    if (req.query.cMin || req.query.cMax) {
      parameterFilters.c = {};
      if (req.query.cMin) parameterFilters.c.min = parseInt(req.query.cMin as string, 10);
      if (req.query.cMax) parameterFilters.c.max = parseInt(req.query.cMax as string, 10);
    }
    if (req.query.dMin || req.query.dMax) {
      parameterFilters.d = {};
      if (req.query.dMin) parameterFilters.d.min = parseInt(req.query.dMin as string, 10);
      if (req.query.dMax) parameterFilters.d.max = parseInt(req.query.dMax as string, 10);
    }
    
    if (Object.keys(parameterFilters).length > 0) {
      filterOptions.parameterFilters = parameterFilters;
    }

    // Parse aggregation options
    const aggregationOptions: AggregationOptions = {};
    
    // Handle pagination
    if (req.query.limit) {
      aggregationOptions.limit = parseInt(req.query.limit as string, 10);
    }
    
    if (req.query.offset) {
      aggregationOptions.offset = parseInt(req.query.offset as string, 10);
    } else if (req.query.page) {
      const page = parseInt(req.query.page as string, 10);
      const limit = aggregationOptions.limit || 20;
      aggregationOptions.offset = (page - 1) * limit;
      if (!req.query.limit) {
        aggregationOptions.limit = limit;
      }
    }
    
    if (req.query.sortBy) {
      aggregationOptions.sortBy = req.query.sortBy as string;
    }
    if (req.query.sortOrder) {
      aggregationOptions.sortOrder = req.query.sortOrder as 'asc' | 'desc';
    }

    // Create streaming pipeline with backpressure handling
    const solutionGenerator = streamSolutionsGenerator(filterOptions, aggregationOptions);
    const sourceStream = createStreamFromAsyncGenerator(solutionGenerator);
    const responseWriter = new StreamingResponseWriter(res);

    // Set up error handling
    sourceStream.on('error', (error) => {
      console.error('Error in solution stream:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to stream solutions',
          message: error.message,
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      }
    });

    responseWriter.on('error', (error) => {
      console.error('Error in response writer:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to write response',
          message: error.message,
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      }
    });

    // Stream data with backpressure handling
    await pipeline(sourceStream, responseWriter);
    
    console.log('Solution streaming completed successfully');
  } catch (error) {
    console.error('Error streaming solutions:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to stream solutions',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    }
  }
});

/**
 * GET /api/solutions/csv
 * Returns all solutions as a CSV file using streaming with backpressure to avoid memory issues
 */
router.get('/csv', async (req: Request, res: Response) => {
  try {
    console.log('Streaming solutions for CSV export with backpressure...');
    
    // Parse filter options (same as above)
    const filterOptions: FilterOptions = {};
    if (req.query.batchRange) {
      filterOptions.batchRange = req.query.batchRange as string;
    }
    const startDate = req.query.dateFrom || req.query.startDate;
    const endDate = req.query.dateTo || req.query.endDate;
    
    if (startDate) {
      filterOptions.dateFrom = new Date(startDate as string);
    }
    if (endDate) {
      filterOptions.dateTo = new Date(endDate as string);
    }
    if (req.query.minCubesCount) {
      filterOptions.minCubesCount = parseInt(req.query.minCubesCount as string, 10);
    }
    if (req.query.maxCubesCount) {
      filterOptions.maxCubesCount = parseInt(req.query.maxCubesCount as string, 10);
    }

    // Create filename based on filters
    const filename = `solutions${filterOptions.batchRange ? '-' + filterOptions.batchRange : ''}.csv`;

    // Create streaming pipeline for CSV export
    const solutionGenerator = streamSolutionsGenerator(filterOptions, {}); // No aggregation for CSV
    const sourceStream = createStreamFromAsyncGenerator(solutionGenerator);
    const csvWriter = new CSVStreamingResponseWriter(res, filename);

    // Set up error handling
    sourceStream.on('error', (error) => {
      console.error('Error in CSV solution stream:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate CSV',
          message: error.message,
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      }
    });

    csvWriter.on('error', (error) => {
      console.error('Error in CSV writer:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to write CSV',
          message: error.message,
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      }
    });

    // Stream CSV data with backpressure handling
    await pipeline(sourceStream, csvWriter);
    
    console.log('CSV streaming completed successfully');
  } catch (error) {
    console.error('Error generating CSV:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate CSV',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    }
  }
});

export default router;
