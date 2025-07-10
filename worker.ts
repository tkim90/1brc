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
      highWaterMark: 1024 * 1024 * 1, // 1MB buffer was the sweet spot for throughput
    });

    // Create readline interface for line-by-line processing
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity, // 'Infinity' means it handles both \n and \r\n correctly
    });

    rl.on("line", (line: string) => {
      rowsProcessed++;

      const parsedLine = parseLine(line);
      const { station, temperature } = parsedLine;

      if (!station || isNaN(temperature)) return;

      if (!(station in stats)) {
        stats[station] = {
          sum: 0,
          cnt: 0,
          min: temperature,
          max: temperature,
        };
      }

      const stationStats = stats[station]!;
      stationStats.sum += temperature;
      stationStats.cnt += 1;
      stationStats.min = Math.min(stationStats.min, temperature);
      stationStats.max = Math.max(stationStats.max, temperature);
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

function parseLine(line: string): { station: string; temperature: number } {
  const parts = line.split(";");
  if (parts.length !== 2) return { station: "", temperature: NaN };
  const station = parts[0]?.trim() ?? "";
  const temperature = Number(parts[1]);
  return { station, temperature };
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
