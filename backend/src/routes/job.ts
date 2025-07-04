import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { config } from '../config';
import { getSocketService } from '../services/socketService';

const router = Router();

// Track running jobs
let currentJob: {
  pid: number;
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
} | null = null;

/**
 * POST /api/job/next
 * Executes run_batch.sh script to process the next batch
 */
router.post('/next', (req: Request, res: Response) => {
  try {
    // Check if a job is already running
    if (currentJob && currentJob.status === 'running') {
      res.status(409).json({
        success: false,
        error: 'Job already running',
        message: `Job with PID ${currentJob.pid} started at ${currentJob.startTime.toISOString()} is still running`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('Starting new batch job...');

    // Determine the script path
    const scriptPath = config.batchScriptPath || path.join('/Users/mpzarde/projects/prime-cubes', 'run_batch.sh');
    
    // Change to the directory containing the script
    const scriptDir = path.dirname(scriptPath);
    
    console.log(`Executing script: ${scriptPath} in directory: ${scriptDir}`);

    // Spawn the run_batch.sh process
    const childProcess = spawn('bash', [scriptPath], {
      cwd: scriptDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    const startTime = new Date();
    const jobId = `job_${Date.now()}_${childProcess.pid}`;
    currentJob = {
      pid: childProcess.pid!,
      startTime,
      status: 'running'
    };

    // Emit job started event via Socket.IO
    const socketService = getSocketService();
    if (socketService) {
      socketService.emitJobStarted(jobId, childProcess.pid!, startTime);
    }

    // Set up data handlers
    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('BATCH OUTPUT:', output);
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log('BATCH ERROR:', output);
    });

    // Handle process completion
    childProcess.on('close', (code) => {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      if (currentJob) {
        currentJob.status = code === 0 ? 'completed' : 'failed';
      }

      console.log(`Batch job completed with exit code: ${code}`);
      console.log(`Duration: ${duration}ms`);
      
      // Emit job completion events via Socket.IO
      const socketService = getSocketService();
      if (socketService) {
        if (code === 0) {
          socketService.emitJobCompleted(jobId, childProcess.pid!, startTime, endTime, `Job completed successfully in ${Math.round(duration / 1000)}s`);
        } else {
          socketService.emitJobFailed(jobId, childProcess.pid!, startTime, endTime, `Job failed with exit code ${code}. Error: ${stderr}`);
        }
      }
    });

    childProcess.on('error', (error) => {
      console.error('Error spawning batch job:', error);
      const endTime = new Date();
      
      if (currentJob) {
        currentJob.status = 'failed';
      }
      
      // Emit job failure event via Socket.IO
      const socketService = getSocketService();
      if (socketService) {
        socketService.emitJobFailed(jobId, childProcess.pid!, startTime, endTime, `Job spawn error: ${error.message}`);
      }
    });

    // Return immediately with job start confirmation
    res.json({
      success: true,
      message: 'Batch job started successfully',
      job: {
        pid: currentJob.pid,
        startTime: currentJob.startTime.toISOString(),
        status: currentJob.status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error starting batch job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start batch job',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/job/status
 * Returns the status of the current job
 */
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: currentJob ? {
      pid: currentJob.pid,
      startTime: currentJob.startTime.toISOString(),
      status: currentJob.status,
      duration: currentJob.status === 'running' 
        ? new Date().getTime() - currentJob.startTime.getTime()
        : null
    } : null,
    timestamp: new Date().toISOString()
  });
});

export default router;
