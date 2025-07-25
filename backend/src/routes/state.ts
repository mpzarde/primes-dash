import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';

const router = Router();

/**
 * GET /api/state
 * Returns current state.json content
 */
router.get('/', (req: Request, res: Response) => {
  const fetchState = async () => {
    try {
      // State file is in the prime-cubes root directory, not logs directory
      const statePath = path.join('/Users/mpzarde/projects/prime-cubes', 'state.json');
      let stateContent = {};

      try {
        const fileContent = await fs.readFile(statePath, 'utf-8');
        stateContent = JSON.parse(fileContent);
      } catch (error) {
        console.warn('State file not found or invalid JSON:', error);
        stateContent = { next_a: 0, complete: false };
      }

      return res.json({
        success: true,
        data: stateContent,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching state:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch state',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  };

  fetchState();
});

export default router;
