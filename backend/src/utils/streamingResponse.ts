import { Response } from 'express';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * Streaming response helper that implements backpressure using res.write() and drain events
 */
export class StreamingResponseWriter extends Transform {
  private response: Response;
  private isFirstChunk = true;
  private streamPaused = false;
  private itemCount = 0;

  constructor(response: Response, options: { 
    arrayWrapper?: boolean;
    contentType?: string;
  } = {}) {
    super({ objectMode: true });
    this.response = response;
    
    // Set response headers
    this.response.setHeader('Content-Type', options.contentType || 'application/json');
    this.response.setHeader('Transfer-Encoding', 'chunked');
    
    // Start JSON array if needed
    if (options.arrayWrapper !== false) {
      this.response.write('{"success":true,"data":[');
    }
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      // Convert chunk to JSON string
      const jsonChunk = JSON.stringify(chunk);
      
      // Add comma separator after first item
      const dataToWrite = this.isFirstChunk ? jsonChunk : ',' + jsonChunk;
      this.isFirstChunk = false;
      this.itemCount++;

      // Use res.write() and handle backpressure
      const writeResult = this.response.write(dataToWrite);
      
      if (!writeResult) {
        // res.write() returned false, meaning the buffer is full
        // Pause the stream and wait for drain event
        this.streamPaused = true;
        
        this.response.once('drain', () => {
          this.streamPaused = false;
          callback(); // Resume processing
        });
      } else {
        // Buffer has space, continue immediately
        callback();
      }
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: Function) {
    try {
      // Close JSON array and add metadata
      const metadata = `],"count":${this.itemCount},"timestamp":"${new Date().toISOString()}"}`;
      
      const writeResult = this.response.write(metadata);
      
      if (!writeResult) {
        this.response.once('drain', () => {
          this.response.end();
          callback();
        });
      } else {
        this.response.end();
        callback();
      }
    } catch (error) {
      callback(error);
    }
  }
}

/**
 * CSV streaming response writer with backpressure
 */
export class CSVStreamingResponseWriter extends Transform {
  private response: Response;
  private isFirstRow = true;

  constructor(response: Response, filename: string = 'export.csv') {
    super({ objectMode: true });
    this.response = response;
    
    // Set CSV response headers
    this.response.setHeader('Content-Type', 'text/csv');
    this.response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    this.response.setHeader('Transfer-Encoding', 'chunked');
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      let csvRow = '';
      
      if (this.isFirstRow) {
        // Write CSV header based on first chunk
        const headers = Object.keys(chunk).join(',');
        csvRow = headers + '\n';
        this.isFirstRow = false;
      }
      
      // Convert chunk to CSV row
      const values = Object.values(chunk).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      );
      csvRow += values.join(',') + '\n';

      // Use res.write() and handle backpressure
      const writeResult = this.response.write(csvRow);
      
      if (!writeResult) {
        // Wait for drain event
        this.response.once('drain', () => {
          callback();
        });
      } else {
        callback();
      }
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: Function) {
    this.response.end();
    callback();
  }
}

/**
 * Helper function to create a readable stream from async iterator
 */
export function createStreamFromAsyncGenerator<T>(
  asyncGenerator: AsyncGenerator<T>
): Readable {
  return new Readable({
    objectMode: true,
    async read() {
      try {
        const { value, done } = await asyncGenerator.next();
        if (done) {
          this.push(null);
        } else {
          this.push(value);
        }
      } catch (error) {
        this.destroy(error as Error);
      }
    }
  });
}
