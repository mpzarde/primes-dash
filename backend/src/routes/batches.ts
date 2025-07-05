import { Router, Request, Response } from 'express';
import { getBatchSummaries } from '../services/logParser';

const router = Router();

/**
 * GET /api/batches
 * Returns list of batch summaries from summary.log
 */
router.get('/', (req: Request, res: Response) => {
  const fetchBatches = async () => {
    try {
      console.log('Fetching batch summaries...');
      const batches = await getBatchSummaries();

      return res.json({
        success: true,
        count: batches.length,
        data: batches,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching batch summaries:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch batch summaries',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  };

  fetchBatches();
});

export default router;
