import { Router, Request, Response } from 'express';
import { getBatchSummaries } from '../services/logParser';

const router = Router();

/**
 * GET /api/batches
 * Returns list of batch summaries from summary.log
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('Fetching batch summaries...');
    const batches = await getBatchSummaries();
    
    res.json({
      success: true,
      count: batches.length,
      data: batches,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching batch summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batch summaries',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
