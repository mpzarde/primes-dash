import { Router, Request, Response } from 'express';
import { getSolutions, getBatchSummaries } from '../services/logParser';

const router = Router();

/**
 * GET /api/solutions
 * Returns all solutions with batch metadata
 * Optional query parameter: batchRange - filter solutions by batch range
 */
router.get('/', (req: Request, res: Response) => {
  const fetchSolutions = async () => {
    try {
      console.log('Fetching solutions...');
      const batchRange = req.query.batchRange as string;

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

      // Enhance solutions with batch metadata and transform to frontend model
      let enhancedSolutions = solutions.map(solution => {
        const batch = batchMap.get(solution.batchId) || null;
        const batchRangeValue = batch?.parameters?.aRange || solution.batchId.replace('run_', '');

        return {
          ...solution,
          // Add direct a, b, c, d properties from parameterCombination
          a: solution.parameterCombination.a,
          b: solution.parameterCombination.b,
          c: solution.parameterCombination.c,
          d: solution.parameterCombination.d,
          // Add batchRange property
          batchRange: batchRangeValue,
          batch
        };
      });

      // Filter solutions by batchRange if provided
      if (batchRange) {
        console.log(`Filtering solutions by batch range: ${batchRange}`);
        enhancedSolutions = enhancedSolutions.filter(solution => 
          solution.batchRange === batchRange
        );
      }

      return res.json({
        success: true,
        count: enhancedSolutions.length,
        data: enhancedSolutions,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching solutions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch solutions',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  };

  fetchSolutions();
});

export default router;
