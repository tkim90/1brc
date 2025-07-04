import { Worker } from "worker_threads";
import * as fs from "fs";

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
  const fileSize = fileStats.size;
  const chunkSize = Math.floor(fileSize / 4);

  // Define chunk boundaries for each worker
  const chunks = [
    { start: 0, end: chunkSize },
    { start: chunkSize, end: chunkSize * 2 },
    { start: chunkSize * 2, end: chunkSize * 3 },
    { start: chunkSize * 3, end: fileSize },
  ];

  // Create workers
  const workers: Promise<WorkerResult>[] = chunks.map((chunk, index) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker("./3-worker.ts", {
        workerData: {
          filePath,
          startByte: chunk.start,
          endByte: chunk.end,
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
