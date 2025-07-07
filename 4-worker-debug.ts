import * as fs from "fs";
import * as readline from "readline";

interface StationStats {
  sum: number;
  cnt: number;
  min: number;
  max: number;
}

// Mock worker data for debugging
const mockWorkerData = {
  filePath: "./test.txt",
  startByte: 0,
  endByte: 1000, // Just process first 1000 bytes for debugging
  workerId: 0,
};

async function processFileChunk() {
  const { filePath, startByte, endByte, workerId } = mockWorkerData;
  const startTime = performance.now();
  
  console.log(`🔧 Worker ${workerId} starting: bytes ${startByte.toLocaleString()} to ${endByte.toLocaleString()}`);

  let rowsProcessed = 0;
  const stats: Record<string, StationStats> = {};

  try {
    // Create a read stream for the specific byte range
    const stream = fs.createReadStream(filePath, {
      start: startByte,
      end: endByte,
      highWaterMark: 1024 * 1024 * 24, // 24MB buffer for high throughput
    });

    // Create readline interface for line-by-line processing
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity, // Handle Windows line endings properly
    });

    // Process each line
    rl.on('line', (line: string) => {
      // Process the line here - parse weather station data
      if (line.trim()) { // Only count non-empty lines
        rowsProcessed++;
        
        // Parse line: format is "StationName;Temperature"
        const parts = line.split(';');
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
            max: temp
          };
        }
        
        const stationStats = stats[station]!;
        stationStats.sum += temp;
        stationStats.cnt += 1;
        stationStats.min = Math.min(stationStats.min, temp);
        stationStats.max = Math.max(stationStats.max, temp);
        debugger;
        
        // This debugger statement will work when running this file directly
        debugger;
        
        console.log(`🔍 Row ${rowsProcessed}: station="${station}", temp=${temp}, stats=`, stationStats);
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
    
    console.log(`✅ Debug worker completed: ${rowsProcessed} rows in ${(processingTime / 1000).toFixed(2)}s`);
    console.log(`📊 Final stats:`, stats);

  } catch (error) {
    console.error(`❌ Worker ${workerId} error:`, error);
    throw error;
  }
}

// Run the debug version
processFileChunk().catch(console.error); 