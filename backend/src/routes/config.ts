import { Router, Request, Response } from 'express';
import { config } from '../config';
import fs from 'fs/promises';
import path from 'path';
import { clearCache } from '../services/logParser';
import { getCurrentTimestampWithoutTimezone } from '../utils/dateUtils';

const router = Router();

/**
 * GET /api/config
 * Returns the current configuration
 */
router.get('/', (req: Request, res: Response) => {
  try {
    // Return a sanitized version of the config (omit sensitive info if any)
    const safeConfig = {
      logsPath: config.logsPath,
      nodeEnv: config.nodeEnv
    };

    res.json({
      success: true,
      data: safeConfig,
      timestamp: getCurrentTimestampWithoutTimezone()
    });
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: getCurrentTimestampWithoutTimezone()
    });
  }
});

/**
 * POST /api/config
 * Updates the configuration
 * Currently only supports updating logsPath
 */
router.post('/', (req: Request, res: Response) => {
  const updateConfig = async () => {
    try {
      const { logsPath } = req.body;

      if (!logsPath) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: logsPath',
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      }

      // Validate that the directory exists
      try {
        await fs.access(logsPath);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid logs path: directory does not exist or is not accessible',
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      }

      // Update the config
      (config as any).logsPath = logsPath;

      // Clear the cache to force reloading from the new directory
      clearCache();

      return res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: { logsPath },
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    } catch (error) {
      console.error('Error updating configuration:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    }
  };

  updateConfig();
});

export default router;
