import { workerData, parentPort } from "worker_threads";
import * as fs from "fs";

interface WorkerData {
  filePath: string;
  startByte: number;
  endByte: number;
  workerId: number;
}

const { filePath, startByte, endByte, workerId } = workerData as WorkerData;

async function processChunk() {
  const startTime = Date.now();
  let rowsProcessed = 0;
  
  // Create a read stream for our specific byte range
  const stream = fs.createReadStream(filePath, {
    start: startByte,
    end: endByte - 1,
    encoding: "utf-8"
  });
  
  let buffer = "";
  let firstLine = true;
  
  for await (const chunk of stream) {
    buffer += chunk;
    const lines = buffer.split("\n");
    
    // Keep the last potentially incomplete line in buffer
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      // Skip the first line if we're not worker 0 (might be incomplete)
      if (firstLine && workerId !== 0) {
        firstLine = false;
        continue;
      }
      firstLine = false;
      
      if (line.trim()) {
        // Process your line here
        const [city, temp] = line.split(";");
        // Do whatever processing you need...
        
        rowsProcessed++;
      }
    }
  }
  
  // Process any remaining line in buffer
  if (buffer.trim()) {
    const [city, temp] = buffer.split(";");
    // Process final line...
    rowsProcessed++;
  }
  
  const processingTime = Date.now() - startTime;
  
  // Send results back to main thread
  parentPort?.postMessage({
    workerId,
    rowsProcessed,
    processingTime
  });
}

processChunk().catch(console.error);