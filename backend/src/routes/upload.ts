import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { getCurrentTimestampWithoutTimezone } from '../utils/dateUtils';
import { clearCache } from '../services/logParser';

const router = Router();

/**
 * Extract batch information from log file content and update summary.log
 */
async function updateSummaryLog(fileName: string, fileContent: string): Promise<void> {
  try {
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.warn(`Log file ${fileName} is empty`);
      return;
    }
    
    // Parse first line for start time and range
    // Look for first pair of numbers in square brackets (this will be the a-range)
    const firstLine = lines[0];
    const startTimeMatch = firstLine.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
    const rangeMatch = firstLine.match(/\[(\d+),(\d+)\]/);
    
    if (!startTimeMatch || !rangeMatch) {
      console.warn(`Could not parse start time or range from first line: ${firstLine}`);
      return;
    }
    
    const startDate = startTimeMatch[1];
    const aMin = parseInt(rangeMatch[1], 10);
    const aMax = parseInt(rangeMatch[2], 10);
    const aRange = `${aMin}-${aMax}`;
    
    // Parse completion line from bottom of file
    // Format: "2025-07-02 17:09:21 Search completed. Checked 50000000000000 combinations in 8334.30 seconds."
    let checked = 0;
    let elapsed = 0;
    let completionDate = startDate; // fallback to start date
    let completionTime = '';
    
    // Look through the last few lines for the completion info
    for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
      const line = lines[i];
      const completionMatch = line.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}):\d{2}\s+Search completed\. Checked (\d+) combinations in ([\d.]+) seconds/);
      if (completionMatch) {
        completionDate = completionMatch[1];
        completionTime = completionMatch[2];
        checked = parseInt(completionMatch[3], 10);
        elapsed = parseFloat(completionMatch[4]);
        break;
      }
    }
    
    // Count "Found X cubes of primes" lines in the content
    const solutionLines = lines.filter(line => 
      line.match(/Found\s+(\d+)\s+cubes\s+of\s+primes/i)
    );
    
    const totalSolutions = solutionLines.length;
    
    // Calculate rate per second
    const rps = elapsed > 0 ? Math.floor(checked / elapsed) : 0;
    
    // Create summary entry using the completion date and time
    const summaryEntry = `${completionDate} ${completionTime} a_range=${aRange} checked=${checked} found=${totalSolutions} elapsed=${elapsed}s rps=${rps}`;
    
    // Append to summary.log
    const summaryPath = path.join(config.logsPath, 'summary.log');
    await fs.appendFile(summaryPath, `\n${summaryEntry}`);
    
    console.log(`Added batch entry to summary.log: ${summaryEntry}`);
  } catch (error) {
    console.error('Error updating summary.log:', error);
    // Don't throw error, just log it - we don't want to fail the upload for this
  }
}

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

      // Extract batch information and update summary.log
      await updateSummaryLog(fileName, fileContent);

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
