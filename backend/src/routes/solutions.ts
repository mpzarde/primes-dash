import { Router, Request, Response } from 'express';
import { getSolutions, getBatchSummaries } from '../services/logParser';

const router = Router();

/**
 * GET /api/solutions
 * Returns all solutions with batch metadata
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('Fetching solutions...');
    
    // Get both solutions and batches to add metadata
    const [solutions, batches] = await Promise.all([
      getSolutions(),
      getBatchSummaries()
    ]);
    
    // Create a map of batch ID to batch info for quick lookup
    const batchMap = new Map();
    batches.forEach(batch => {
      batchMap.set(batch.id, batch);
    });
    
    // Enhance solutions with batch metadata
    const enhancedSolutions = solutions.map(solution => ({
      ...solution,
      batch: batchMap.get(solution.batchId) || null
    }));
    
    res.json({
      success: true,
      count: enhancedSolutions.length,
      data: enhancedSolutions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching solutions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch solutions',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
