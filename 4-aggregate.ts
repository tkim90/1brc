import * as fs from "fs";
import * as os from "os";
import { Worker } from "worker_threads";

interface StationStats {
  sum: number;
  cnt: number;
  min: number;
  max: number;
}

interface WorkerResult {
  workerId: number;
  rowsProcessed: number;
  processingTime: number;
  stats: Record<string, StationStats>;
}

/**
 * Seeks forward from a position to find the next occurrence of a target byte (either at or after that position)
 * @param targetByte - The byte to search for (e.g., '\n' = 0x0A)
 * @param fromBufferPosition - Starting position to search from
 * @param fd - File descriptor
 * @returns Position of the target byte, or -1 if not found
 */
function getNextTargetBytePosition(targetByte: number, fromBufferPosition: number, fd: number, fileSize: number): number {
  const ONE_MB_BYTES = 1024 * 1024;
  let startingBufferPosition = fromBufferPosition;

  while (startingBufferPosition < fileSize) {
    // Calculate how many bytes are left to read
    const remainingBytes = fileSize - startingBufferPosition;
    const bytesToRead = Math.min(ONE_MB_BYTES, remainingBytes);
    const buffer = Buffer.alloc(bytesToRead);

    const readBuffer = fs.readSync(fd, buffer, 0, bytesToRead, startingBufferPosition);

    if (readBuffer === 0) return -1;

    for (let i = 0; i < readBuffer; i++) {
      if (buffer[i] === targetByte) {
        const targetBytePosition = startingBufferPosition + i;
        return targetBytePosition;
      }
    }

    startingBufferPosition += readBuffer;
  }
  return -1;
}

/**
 * Creates file chunks that are aligned to line boundaries
 * Ensures no line is split across multiple workers
 */
function createLineAlignedChunks(filePath: string, cpuCount: number): Array<{start: number, end: number}> {
  const fileStats = fs.statSync(filePath);
  const FILE_SIZE = fileStats.size;

  // open the file once and reuse the file descriptor for all readSync() operations
  const fd = fs.openSync(filePath, "r");
  
  const approxChunkSize = Math.floor(FILE_SIZE / cpuCount);
  const byteChunks: Array<{start: number, end: number}> = [];
  
  let cursor = 0; // Start of next chunk
  
  try {
    for (let i = 0; i < cpuCount; i++) {
      let currentChunkLastByte: number;
      
      const isLastChunk = i === cpuCount - 1;
      if (isLastChunk) {
        currentChunkLastByte = FILE_SIZE - 1;
      } else {
        // Ends at position 'approxChunkSize - 1' since cursor is 0-indexed
        const tentativeChunkEndPosition = cursor + approxChunkSize - 1;

        // Calculate the actual chunk end position by finding the last newline value in the chunk.
        // This makes sure no chunk has a line split across it.
        const newLineByteValue = 0x0A; // '\n' byte value
        const chunkEndPos = getNextTargetBytePosition(newLineByteValue, tentativeChunkEndPosition, fd, FILE_SIZE);
        
        if (chunkEndPos === -1) {
          // No newline found, we're at the end of the file
          currentChunkLastByte = FILE_SIZE - 1;
        } else {
          currentChunkLastByte = chunkEndPos;
        }
      }
      
      byteChunks.push({
        start: cursor,
        end: currentChunkLastByte
      });
      
      // Next chunk starts after the last byte of the current chunk
      cursor = currentChunkLastByte + 1;
      
      // If we've reached the end of file, break out of the loop
      if (cursor >= FILE_SIZE) break;
    }
  } finally {
    fs.closeSync(fd);
  }
  
  return byteChunks;
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

  // Master statistics aggregation
  const masterStats = new Map<string, StationStats>();

  // Create workers with proper error handling
  const workers: Promise<WorkerResult>[] = chunkRanges.map((fileChunk, index) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker("./4-worker.ts", {
        workerData: {
          filePath,
          startByte: fileChunk.start,
          endByte: fileChunk.end,
          workerId: index,
        },
      });

      worker.on("message", (result: WorkerResult) => {
        console.log(`✅ Worker ${result.workerId} completed: ${result.rowsProcessed} rows in ${(result.processingTime / 1000).toFixed(2)}s`);
        
        // Aggregate statistics from this worker
        for (const [station, stats] of Object.entries(result.stats)) {
          if (!masterStats.has(station)) {
            masterStats.set(station, {
              sum: stats.sum,
              cnt: stats.cnt,
              min: stats.min,
              max: stats.max
            });
          } else {
            const existing = masterStats.get(station)!;
            existing.sum += stats.sum;
            existing.cnt += stats.cnt;
            existing.min = Math.min(existing.min, stats.min);
            existing.max = Math.max(existing.max, stats.max);
          }
        }
        
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

  // Generate final output in required format
  const outputParts: string[] = [];
  
  // Sort stations alphabetically
  const sortedStations = Array.from(masterStats.keys()).sort();
  
  for (const station of sortedStations) {
    const stats = masterStats.get(station)!;
    const mean = stats.sum / stats.cnt;
    outputParts.push(`${station}:${stats.min.toFixed(1)}/${mean.toFixed(1)}/${stats.max.toFixed(1)}`);
  }
  
  // const finalOutput = `{${outputParts.join(', ')}}`;
  // console.log(finalOutput);

  return results;
}

// Set optimal thread pool size for file I/O
process.env.UV_THREADPOOL_SIZE = os.cpus().length.toString();

// Get file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
  console.error("❌ Please provide a file path as an argument, e.g.: bun 4-aggregate.ts <filename>");
  process.exit(1);
}

// Run it
processFileInParallel(filePath)
  // .then((results) => {
  //   console.log("\n📈 Worker Performance Summary:");
  //   results.forEach(r => {
  //     const rowsPerSec = Math.round(r.rowsProcessed / (r.processingTime / 1000));
  //     console.log(`  Worker ${r.workerId}: ${r.rowsProcessed.toLocaleString()} rows @ ${rowsPerSec.toLocaleString()} rows/s`);
  //   });
  // })
  .catch(console.error);

function getDuration(startTime: number, endTime: number) {
  const durationSeconds = (endTime - startTime) / 1000;
  return durationSeconds;
}

// Export for testing
export { processFileInParallel };
