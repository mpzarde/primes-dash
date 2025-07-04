import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Configuration object with environment variables
export const config = {
  // Logs path configuration
  logsPath: process.env.LOGS_PATH || '/Users/mpzarde/projects/prime-cubes/logs',
  
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Batch script path
  batchScriptPath: process.env.BATCH_SCRIPT_PATH || '/Users/mpzarde/projects/prime-cubes/run_batch.sh',
} as const;

// Export individual values for convenience
export const {
  logsPath,
  port,
  nodeEnv,
  batchScriptPath,
} = config;

// Validate required configuration
if (!logsPath) {
  throw new Error('LOGS_PATH environment variable is required');
}

export default config;
