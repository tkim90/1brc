import { createReadStream } from "fs";
import { createInterface } from "readline";
import { parentPort, workerData } from "worker_threads";

interface WorkerData {
  fileDescriptor: number;
  filePath: string;
  startByte: number;
  endByte: number;
}

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

async function processFileChunk() {
  const { filePath, startByte, endByte }: WorkerData = workerData;
  const startTime = performance.now();

  console.log(
    `🔧 Worker starting: bytes ${startByte.toLocaleString()} to ${endByte.toLocaleString()}`
  );

  let rowsProcessed = 0;
  const stats: Record<string, StationStats> = {};

  try {
    // Create a read stream for the specific byte range
    const stream = createReadStream(filePath, {
      start: startByte,
      end: endByte,
      highWaterMark: 1024 * 1024 * 1, // 24MB buffer for high throughput
    });

    // Create readline interface for line-by-line processing
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity, // Handle Windows line endings properly
    });

    // Process each line
    rl.on("line", (line: string) => {
      // Process the line here - parse weather station data
      rowsProcessed++;

      // Parse line: format is "StationName;Temperature"
      const parts = line.split(";");
      if (parts.length !== 2) {
        // Skip malformed lines
        return;
      }

      const station = parts[0]?.trim();
      const temp = Number(parts[1]);

      if (!station || isNaN(temp)) {
        // Skip lines with invalid station name or temperature
        return;
      }

      // Update statistics for this station
      if (!(station in stats)) {
        stats[station] = {
          sum: 0,
          cnt: 0,
          min: temp,
          max: temp,
        };
      }

      const stationStats = stats[station]!;
      stationStats.sum += temp;
      stationStats.cnt += 1;
      stationStats.min = Math.min(stationStats.min, temp);
      stationStats.max = Math.max(stationStats.max, temp);
    });

    // Wait for the stream to finish processing
    await new Promise<void>((resolve, reject) => {
      rl.on("close", resolve);
      rl.on("error", reject);
    });

    const processingTime = performance.now() - startTime;

    const result: WorkerResult = {
      rowsProcessed,
      processingTime,
      stats,
    };

    // Send result back to main thread
    if (parentPort) {
      parentPort.postMessage(result);
    }
  } catch (error) {
    console.error(`❌ Worker error:`, error);
    if (parentPort) {
      parentPort.postMessage({
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
