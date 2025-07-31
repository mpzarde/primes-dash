import { Router, Request, Response } from 'express';
import { streamBatchesGenerator, FilterOptions, AggregationOptions } from '../services/streamingLogParser';
import { StreamingResponseWriter, createStreamFromAsyncGenerator } from '../utils/streamingResponse';
import { pipeline } from 'stream/promises';

const router = Router();

/**
 * GET /api/batches
 * Returns list of batch summaries from summary.log with true streaming and backpressure handling
 * Query parameters:
 *   - dateFrom/startDate: Start date for filtering (ISO string)
 *   - dateTo/endDate: End date for filtering (ISO string)
 *   - batchRange: Filter by specific batch range (e.g., "1-50")
 *   - limit: Maximum number of results to return
 *   - offset: Number of results to skip
 *   - page: Page number (alternative to offset, starts from 1)
 *   - sortBy: Field to sort by
 *   - sortOrder: 'asc' or 'desc'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('Streaming batch summaries with backpressure...');
    
    // Parse filter options
    const filterOptions: FilterOptions = {};
    
    // Support both dateFrom/dateTo and startDate/endDate
    const startDate = req.query.dateFrom || req.query.startDate;
    const endDate = req.query.dateTo || req.query.endDate;
    
    if (startDate) {
      filterOptions.dateFrom = new Date(startDate as string);
    }
    if (endDate) {
      filterOptions.dateTo = new Date(endDate as string);
    }
    if (req.query.batchRange) {
      filterOptions.batchRange = req.query.batchRange as string;
    }

    // Parse aggregation options with pagination support
    const aggregationOptions: AggregationOptions = {};
    
    // Handle pagination - support both offset and page parameters
    if (req.query.limit) {
      aggregationOptions.limit = parseInt(req.query.limit as string, 10);
    }
    
    if (req.query.offset) {
      aggregationOptions.offset = parseInt(req.query.offset as string, 10);
    } else if (req.query.page) {
      // Convert page number to offset (page starts from 1)
      const page = parseInt(req.query.page as string, 10);
      const limit = aggregationOptions.limit || 20; // Default limit if not specified
      aggregationOptions.offset = (page - 1) * limit;
      if (!req.query.limit) {
        aggregationOptions.limit = limit; // Set default limit when using page
      }
    }
    
    if (req.query.sortBy) {
      aggregationOptions.sortBy = req.query.sortBy as string;
    }
    if (req.query.sortOrder) {
      aggregationOptions.sortOrder = req.query.sortOrder as 'asc' | 'desc';
    }

    // Create streaming pipeline with backpressure handling
    const batchGenerator = streamBatchesGenerator(filterOptions, aggregationOptions);
    const sourceStream = createStreamFromAsyncGenerator(batchGenerator);
    const responseWriter = new StreamingResponseWriter(res);

    // Set up error handling
    sourceStream.on('error', (error) => {
      console.error('Error in batch stream:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to stream batch summaries',
          message: error.message,
          timestamp: new Date().toISOString()
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
          timestamp: new Date().toISOString()
        });
      }
    });

    // Stream data with backpressure handling
    await pipeline(sourceStream, responseWriter);
    
    console.log('Batch streaming completed successfully');
  } catch (error) {
    console.error('Error streaming batch summaries:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to stream batch summaries',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
});

export default router;
