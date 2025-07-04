import * as fs from "fs";
import { Worker } from "worker_threads";

interface WorkerResult {
  workerId: number;
  rowsProcessed: number;
  processingTime: number;
  // Add whatever data you need to collect from each worker
  results?: any[];
}

async function processFileInParallel(filePath: string) {
  const startTime = performance.now();

  // Get file size to calculate chunk boundaries
  const fileStats = fs.statSync(filePath);
  console.log("✨1 fileStats", fileStats);
  
  const FILE_SIZE = fileStats.size;
  console.log("✨2 fileSize", FILE_SIZE);

  const SIZE_PER_FILE_CHUNK = Math.floor(FILE_SIZE / 4);
  console.log("✨3 SIZE_PER_FILE_CHUNK", SIZE_PER_FILE_CHUNK);

  // Define chunk boundaries for each worker
  const chunkRanges = Array.from({ length: 4 }, (_, i) => ({
    start: SIZE_PER_FILE_CHUNK * i,
    end: SIZE_PER_FILE_CHUNK * (i + 1),
  }));

  // Create workers
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
        resolve(result);
      });

      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  });

  // Wait for all workers to complete
  const results = await Promise.all(workers);

  const endTime = performance.now();
  const durationSeconds = getDuration(startTime, endTime);
  const totalRows = results.reduce((sum, r) => sum + r.rowsProcessed, 0);

  console.log(`Processed ${totalRows} rows in ${durationSeconds}s`);
  console.log(
    `Average: ${Math.round(totalRows / durationSeconds)} rows/second`
  );

  return results;
}

// Run it
processFileInParallel("./measurements.txt")
  .then((results) => console.log("Complete!", results))
  .catch(console.error);

function getDuration(startTime: number, endTime: number) {
  const durationSeconds = (endTime - startTime) / 1000;
  return durationSeconds;
}
