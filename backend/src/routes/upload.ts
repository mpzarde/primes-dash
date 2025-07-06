import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { getCurrentTimestampWithoutTimezone } from '../utils/dateUtils';
import { clearCache } from '../services/logParser';

const router = Router();

/**
 * POST /api/upload
 * Uploads a batch log file to the logs directory
 * Validates that a file with the same name doesn't already exist
 */
router.post('/', (req: Request, res: Response) => {
  const uploadFile = async () => {
    try {
      // Check if request contains file data
      if (!req.body || !req.body.fileContent || !req.body.fileName) {
        return res.status(400).json({
          success: false,
          error: 'Missing file data',
          message: 'Request must include fileName and fileContent',
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      }

      const { fileName, fileContent } = req.body;
      const filePath = path.join(config.logsPath, fileName);

      // Check if file already exists
      try {
        await fs.access(filePath);
        // If we get here, the file exists
        return res.status(409).json({
          success: false,
          error: 'File already exists',
          message: `A batch log with the name "${fileName}" already exists`,
          timestamp: getCurrentTimestampWithoutTimezone()
        });
      } catch (error) {
        // File doesn't exist, which is what we want
      }

      // Write the file
      await fs.writeFile(filePath, fileContent);

      // Clear the cache to force reloading the new file
      clearCache();

      return res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        fileName,
        filePath,
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload file',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: getCurrentTimestampWithoutTimezone()
      });
    }
  };

  uploadFile();
});

export default router;
