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
  rowsProcessed: number;
  processingTime: number;
  stats: Record<string, StationStats>;
}

/**
 * Seeks backward from a position to find the previous occurrence of a newline character
 * @param startingByteOffset - Starting byte position to search backward from
 * @param fd - File descriptor
 * @returns Position of the newline character, or -1 if not found
 */
function getPreviousNewlinePosition(startingByteOffset: number, fd: number): number {
  const CHAR_NEWLINE = '\n'.charCodeAt(0);
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const BUFFER = new Uint8Array(CHUNK_SIZE);

  let searchEndByte = startingByteOffset;

  // Search backward in chunks
  while (searchEndByte > 0) {
    const searchStartByte = Math.max(0, searchEndByte - CHUNK_SIZE);

    const bytesRead = fs.readSync(fd, BUFFER, 0, CHUNK_SIZE, searchStartByte);

    if (bytesRead === 0) return -1;

    // Search backward through this chunk
    for (let i = bytesRead - 1; i >= 0; i--) {
      if (BUFFER[i] === CHAR_NEWLINE) {
        // Newline found. Return the byte position where we found it
        const newlineByteOffset = searchStartByte + i;
        return newlineByteOffset;
      }
    }

    searchEndByte = searchStartByte;
  }
  return -1;
}

/**
 * Creates file chunks that are aligned to line boundaries
 * Ensures no line is split across multiple workers
 */
function createChunks(filePath: string, cpuCount: number): Array<{start: number, end: number}> {
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

        // Calculate the actual chunk end position by finding the previous newline before the tentative end.
        // This ensures chunks contain complete lines and don't truncate station names.
        const chunkEndPos = getPreviousNewlinePosition(tentativeChunkEndPosition, fd);
        
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
      // For chunks that end at a newline, we want the next chunk to start at the character after the newline
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

  const CPU_COUNT = os.cpus().length;
  //                os.availableParallelism(); if you're running on Docker
  const fileChunks = createChunks(filePath, CPU_COUNT);
  const masterStats = new Map<string, StationStats>();
  
  console.log(`• Starting ${fileChunks.length} workers...`);

  const workers: Promise<WorkerResult>[] = fileChunks.map((fileChunk, index) => {
    return new Promise((resolve, reject) => {
      // Use .ts for Bun, .js for Node.js
      const workerPath = typeof Bun !== 'undefined' ? "./worker.ts" : "./worker.js";
      const worker = new Worker(workerPath, {
        workerData: {
          filePath,
          startByte: fileChunk.start,
          endByte: fileChunk.end,
        },
      });

      worker.on("message", (result: WorkerResult) => {
        console.log(`✅ Worker completed: ${result.rowsProcessed} rows in ${(result.processingTime / 1000).toFixed(2)}s`);
        
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

  const results = await Promise.all(workers);

  const totalRows = results.reduce((sum, r) => sum + r.rowsProcessed, 0);
  const outputParts: string[] = [];
  const sortedStations = Array.from(masterStats.keys()).sort();
  
  for (const station of sortedStations) {
    const stats = masterStats.get(station)!;
    const mean = stats.sum / stats.cnt;
    outputParts.push(`${station}:${stats.min.toFixed(1)}/${mean.toFixed(1)}/${stats.max.toFixed(1)}`);
  }
  
  const endTime = performance.now();
  const durationSeconds = getDuration(startTime, endTime);
  console.log(`\n🟢 COMPLETE! 🟢`);
  console.log(`• Total rows processed: ${totalRows.toLocaleString()}`);
  console.log(`• Total time: ${durationSeconds.toFixed(2)}s`);
  console.log(`• Average throughput: ${Math.round(totalRows / durationSeconds).toLocaleString()} rows/second`);
  
  const finalOutput = `{${outputParts.join(',\n')}}`;
  console.log(finalOutput.slice(0, 1000));
  return results;
}

process.env.UV_THREADPOOL_SIZE = os.cpus().length.toString();
const filePath = process.argv[2];

if (!filePath) {
  console.error("❌ Please provide a file path as an argument, e.g.: bun main.ts <filename>");
  process.exit(1);
}

/*====================================*/
/*           Run the program          */
/*====================================*/
processFileInParallel(filePath)
  .catch(console.error);

function getDuration(startTime: number, endTime: number) {
  const durationSeconds = (endTime - startTime) / 1000;
  return durationSeconds;
}

// Export for testing
export { processFileInParallel };
