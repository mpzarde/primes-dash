# Backpressure and Throttling Implementation

## Overview
This implementation adds proper backpressure handling to prevent memory issues when streaming large datasets via HTTP responses.

## Key Components

### 1. StreamingResponseWriter (`src/utils/streamingResponse.ts`)
- Uses `res.write()` instead of collecting data in memory
- Monitors write buffer status (returns `false` when buffer is full)
- Pauses the source stream when buffer is full
- Resumes processing on `drain` event when buffer has space
- Prevents memory buildup by applying backpressure properly

### 2. Async Generators (`src/services/streamingLogParser.ts`)
- `streamBatchesGenerator()` - yields batches one at a time
- `streamSolutionsGenerator()` - yields solutions one at a time
- No memory accumulation - processes files line by line
- Proper filtering and pagination at the stream level

### 3. Updated Routes (`src/routes/batches.ts`, `src/routes/solutions.ts`)
- Use streaming pipeline with `pipeline()` from `stream/promises`
- Proper error handling for both source and destination streams
- Real-time streaming without buffering entire datasets

## How Backpressure Works

1. **Write Buffer Monitoring**: When `res.write()` returns `false`, it means the client can't keep up
2. **Stream Pausing**: The source stream is paused to prevent data accumulation
3. **Drain Event**: When the client catches up, the `drain` event fires
4. **Stream Resuming**: Processing resumes, maintaining controlled memory usage

## Benefits

- **Memory Efficient**: Constant memory usage regardless of dataset size
- **Client-Responsive**: Adapts to slow clients automatically  
- **Scalable**: Can handle millions of records without memory issues
- **Real-time**: Data flows as it's processed, not batch-collected

## Testing

The implementation has been tested with:
- Simulated slow clients (test-backpressure.js)
- Large dataset streaming
- HTTP chunked transfer encoding
- Proper error handling

## Usage

```javascript
// Streaming with backpressure
const generator = streamBatchesGenerator(filters, options);
const sourceStream = createStreamFromAsyncGenerator(generator);
const responseWriter = new StreamingResponseWriter(res);
await pipeline(sourceStream, responseWriter);
```

## Key Differences from Previous Implementation

**Before**: 
- Collected all results in memory arrays
- Sent entire response at once
- Memory usage grew with dataset size

**After**:
- Streams data one item at a time
- Uses `res.write()` with drain event handling  
- Constant memory usage regardless of dataset size
