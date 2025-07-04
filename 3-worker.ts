import * as fs from "fs";
import * as readline from "readline";
import { parentPort, workerData } from "worker_threads";

interface WorkerData {
  filePath: string;
  startByte: number;
  endByte: number;
  workerId: number;
}

interface WorkerResult {
  workerId: number;
  rowsProcessed: number;
  processingTime: number;
  results?: any[];
}

async function processFileChunk() {
  const { filePath, startByte, endByte, workerId }: WorkerData = workerData;
  const startTime = performance.now();
  
  console.log(`🔧 Worker ${workerId} starting: bytes ${startByte.toLocaleString()} to ${endByte.toLocaleString()}`);

  let rowsProcessed = 0;

  try {
    // Create a read stream for the specific byte range
    const stream = fs.createReadStream(filePath, {
      start: startByte,
      end: endByte,
      highWaterMark: 16 * 1024 * 1024, // 16MB buffer for high throughput
    });

    // Create readline interface for line-by-line processing
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity, // Handle Windows line endings properly
    });

    // Process each line
    rl.on('line', (line: string) => {
      // Process the line here - for now just count rows
      // In a real implementation, you'd parse the line data
      if (line.trim()) { // Only count non-empty lines
        rowsProcessed++;
        
        // Optional: Parse line data here
        // const data = line.split(','); // for CSV
        // const parsed = JSON.parse(line); // for JSON lines
        
        // For performance, avoid console.log in the hot loop
        // Only log progress occasionally
        if (rowsProcessed % 1000000 === 0) {
          console.log(`⚡ Worker ${workerId}: ${rowsProcessed.toLocaleString()} rows processed`);
        }
      }
    });

    // Handle completion
    await new Promise<void>((resolve, reject) => {
      rl.on('close', () => {
        resolve();
      });

      rl.on('error', (error) => {
        reject(error);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });

    const processingTime = performance.now() - startTime;
    
    const result: WorkerResult = {
      workerId,
      rowsProcessed,
      processingTime,
    };

    // Send result back to main thread
    parentPort?.postMessage(result);

  } catch (error) {
    console.error(`❌ Worker ${workerId} error:`, error);
    throw error;
  }
}

// Start processing if this is run as a worker
if (parentPort) {
  processFileChunk().catch((error) => {
    console.error(`💥 Worker ${workerData.workerId} failed:`, error);
    process.exit(1);
  });
} else {
  console.error("This script should only be run as a worker thread");
  process.exit(1);
}
