import * as fs from "fs";
import * as os from "os";
import { Worker } from "worker_threads";

interface WorkerResult {
  workerId: number;
  rowsProcessed: number;
  processingTime: number;
  // Add whatever data you need to collect from each worker
  results?: any[];
}

/**
 * Seeks forward from a position to find the next occurrence of a target byte
 * @param targetByte - The byte to search for (e.g., '\n' = 0x0A)
 * @param fromBytePosition - Starting position to search from
 * @param fd - File descriptor
 * @returns Position of the target byte, or -1 if not found
 */
function seekForwardToByte(targetByte: number, fromBytePosition: number, fd: number): number {
  const BUFFER_SIZE_BYTES = 1024 * 1024 * 16; // Read in batches of 1MB to cap RAM usage
  const buffer = Buffer.alloc(BUFFER_SIZE_BYTES);
  let bytePosition = fromBytePosition;
  
  while (true) {
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, bytePosition);
    
    // Exit if we've reached the end of the file (this is how fs.readSync works)
    if (bytesRead === 0) return -1;
    
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === targetByte) {
        // We found the target byte (ex. `\n` aka `0x0A`), return the byte position + 1 (because we want to start at the next byte)
        return bytePosition + i;
      }
    }
    
    // Move to the next batch of bytes
    bytePosition += bytesRead;
  }
}

/**
 * Creates file chunks that are aligned to line boundaries
 * Ensures no line is split across multiple workers
 */
function createLineAlignedChunks(filePath: string, cpuCount: number): Array<{start: number, end: number}> {
  const fileStats = fs.statSync(filePath);
  const FILE_SIZE = fileStats.size;
  const fd = fs.openSync(filePath, "r");
  
  const approxChunkSize = Math.floor(FILE_SIZE / cpuCount);
  const chunks: Array<{start: number, end: number}> = [];
  
  let cursor = 0; // Start of next chunk
  
  try {
    for (let i = 0; i < cpuCount; i++) {
      let chunkEnd: number;
      
      if (i === cpuCount - 1) {
        // Last chunk: goes to end of file
        chunkEnd = FILE_SIZE - 1;
      } else {
        // Find tentative end position
        let tentativeEnd = cursor + approxChunkSize - 1;
        
        // Seek forward to find the next newline
        const newlinePos = seekForwardToByte(0x0A, tentativeEnd, fd); // 0x0A = '\n'
        
        if (newlinePos === -1) {
          // No newline found, this chunk goes to end of file
          chunkEnd = FILE_SIZE - 1;
        } else {
          chunkEnd = newlinePos;
        }
      }
      
      chunks.push({
        start: cursor,
        end: chunkEnd
      });
      
      // Next chunk starts after the newline
      cursor = chunkEnd + 1;
      
      // If we've reached the end of file, break
      if (cursor >= FILE_SIZE) {
        break;
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  
  return chunks;
}

async function processFileInParallel(filePath: string) {
  const startTime = performance.now();

  // Get file size and CPU count for optimal chunking
  const fileStats = fs.statSync(filePath);
  const FILE_SIZE = fileStats.size;
  const CPU_COUNT = os.cpus().length;
  
  console.log(`📊 File size: ${(FILE_SIZE / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`🖥️  Using ${CPU_COUNT} CPU cores`);

  // Create line-aligned chunks
  const chunkRanges = createLineAlignedChunks(filePath, CPU_COUNT);
  
  console.log(`📦 Created ${chunkRanges.length} line-aligned chunks:`);
  chunkRanges.forEach((chunk, i) => {
    const sizeBytes = chunk.end - chunk.start + 1;
    console.log(`  Chunk ${i}: ${chunk.start.toLocaleString()} to ${chunk.end.toLocaleString()} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  });

  console.log(`🚀 Starting ${chunkRanges.length} workers...`);

  // Create workers with proper error handling
  const workers: Promise<WorkerResult>[] = chunkRanges.map((fileChunk, index) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker("./3-worker.ts", {
        workerData: {
          filePath,
          startByte: fileChunk.start,
          endByte: fileChunk.end,
          workerId: index,
        },
      });

      worker.on("message", (result: WorkerResult) => {
        // console.log(`✅ Worker ${result.workerId} completed: ${result.rowsProcessed} rows in ${(result.processingTime / 1000).toFixed(2)}s`);
        resolve(result);
      });

      worker.on("error", (error) => {
        console.error(`❌ Worker ${index} error:`, error);
        reject(error);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker ${index} stopped with exit code ${code}`));
        }
      });
    });
  });

  // Wait for all workers to complete
  const results = await Promise.all(workers);

  const endTime = performance.now();
  const durationSeconds = getDuration(startTime, endTime);
  const totalRows = results.reduce((sum, r) => sum + r.rowsProcessed, 0);

  console.log(`\n🎉 COMPLETE!`);
  console.log(`📊 Total rows processed: ${totalRows.toLocaleString()}`);
  console.log(`⏱️  Total time: ${durationSeconds.toFixed(2)}s`);
  console.log(`🚀 Average throughput: ${Math.round(totalRows / durationSeconds).toLocaleString()} rows/second`);
  console.log(`💾 Data throughput: ${((FILE_SIZE / 1024 / 1024) / durationSeconds).toFixed(2)} MB/s`);

  return results;
}

// Set optimal thread pool size for file I/O
process.env.UV_THREADPOOL_SIZE = os.cpus().length.toString();

// Run it
processFileInParallel("./measurements.txt")
  .then((results) => {
    console.log("\n📈 Worker Performance Summary:");
    results.forEach(r => {
      const rowsPerSec = Math.round(r.rowsProcessed / (r.processingTime / 1000));
      console.log(`  Worker ${r.workerId}: ${r.rowsProcessed.toLocaleString()} rows @ ${rowsPerSec.toLocaleString()} rows/s`);
    });
  })
  .catch(console.error);

function getDuration(startTime: number, endTime: number) {
  const durationSeconds = (endTime - startTime) / 1000;
  return durationSeconds;
}

// Export for testing
export { processFileInParallel };
