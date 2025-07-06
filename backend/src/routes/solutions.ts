import { Router, Request, Response } from 'express';
import { getSolutions, getBatchSummaries } from '../services/logParser';
import { getCurrentTimestampWithoutTimezone } from '../utils/dateUtils';

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
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    } catch (error) {
      console.error('Error fetching solutions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch solutions',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    }
  };

  fetchSolutions();
});

/**
 * GET /api/solutions/csv
 * Returns all solutions as a CSV file
 * Optional query parameter: batchRange - filter solutions by batch range
 */
router.get('/csv', (req: Request, res: Response) => {
  const fetchSolutionsAsCsv = async () => {
    try {
      console.log('Fetching solutions for CSV export...');
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
        console.log(`Filtering solutions by batch range for CSV: ${batchRange}`);
        enhancedSolutions = enhancedSolutions.filter(solution => 
          solution.batchRange === batchRange
        );
      }

      // Convert solutions to CSV format
      // CSV header
      let csvContent = 'a,b,c,d\n';

      // Add each solution as a row
      enhancedSolutions.forEach(solution => {
        csvContent += `${solution.a},${solution.b},${solution.c},${solution.d}\n`;
      });

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="solutions${batchRange ? '-' + batchRange : ''}.csv"`);

      // Send CSV content
      return res.send(csvContent);
    } catch (error) {
      console.error('Error generating CSV:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate CSV',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    }
  };

  fetchSolutionsAsCsv();
});

export default router;
