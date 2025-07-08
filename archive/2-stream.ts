import { readFileSync } from "fs";

// Goal: Read entire content in less than 10 seconds

console.log("Hello via Bun!");
const startTime = performance.now();

const buffer = readFileSync("measurements.txt");
const content = buffer.toString('utf-8');
const lines = content.split('\n');

let count = 0;
for (const line of lines) {
  if (line.trim()) { // Only count non-empty lines
    count++;
  }
}

const endTime = performance.now();
const durationSeconds = getDuration(startTime, endTime);
console.log(`Read ${count} lines in ${durationSeconds.toFixed(3)} seconds`);

// ==== Helper functions ====
function getDuration(startTime: number, endTime: number) {
  const durationSeconds = (endTime - startTime) / 1000;
  return durationSeconds;
}

// Craps out at 210k rows
// Read 210501 lines in 5.041 seconds
