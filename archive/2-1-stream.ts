import { createReadStream } from "fs";
import { pipeline, Transform } from "stream";

// Goal: Read entire content in less than 10 seconds

console.log("Hello via Bun!");
const startTime = performance.now();

const readStream = createReadStream("measurements.txt", {
  highWaterMark: 64 * 1024 // 64KB chunks
});

const processStream = new Transform({
  transform(chunk, encoding, callback) {
    // Process chunk here
    // For example, parse lines and process them
    const lines = chunk.toString().split('\n');
    // ... your processing logic ...
    callback();
  }
});

await pipeline(readStream, processStream);

const endTime = performance.now();
console.log(`Processed in ${endTime - startTime}ms`);
