import { createReadStream } from "fs";
import * as readline from "readline";

// Goal: Read entire content in less than 10 seconds

console.log("Hello via Bun!");
const startTime = performance.now();

const stream = createReadStream("measurements.txt", { encoding: "utf-8" });
const rl = readline.createInterface({
  input: stream,
  crlfDelay: Infinity,
});

let count = 0;
rl.on("line", (line) => {
  count++;
});

rl.on("close", () => {
  const endTime = performance.now();
  const durationSeconds = getDuration(startTime, endTime);
  console.log(`Read ${count} lines in ${durationSeconds.toFixed(3)} seconds`);
});

// ==== Helper functions ====
function getDuration(startTime: number, endTime: number) {
  const durationSeconds = (endTime - startTime) / 1000;
  return durationSeconds;
}

// Craps out at 210k rows
// Read 210501 lines in 5.041 seconds
