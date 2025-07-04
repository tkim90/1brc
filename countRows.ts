import * as fs from "fs";
import * as readline from "readline";

async function countRows(filePath: string): Promise<number> {
  const startTime = performance.now();
  
  console.log(`📊 Counting rows in ${filePath}...`);
  
  let rowCount = 0;
  
  // Create a read stream for the file
  const stream = fs.createReadStream(filePath, {
    highWaterMark: 16 * 1024 * 1024, // 16MB buffer for high throughput
  });

  // Create readline interface for line-by-line processing
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity, // Handle Windows line endings properly
  });

  // Process each line
  rl.on('line', (line: string) => {
    if (line.trim()) { // Only count non-empty lines
      rowCount++;
      
      // Log progress occasionally for large files
      if (rowCount % 1000000 === 0) {
        // Get file size to calculate progress percentage
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;
        
        // Estimate progress based on bytes read vs total file size
        const bytesRead = stream.bytesRead || 0;
        const progressPercent = Math.min(100, Math.round((bytesRead / fileSize) * 100));
        
        console.log(`⚡ Progress: ${progressPercent}% - Processed ${rowCount.toLocaleString()} rows...`);
      }
    }
  });

  // Wait for completion
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

  const endTime = performance.now();
  const durationSeconds = (endTime - startTime) / 1000;
  
  console.log(`\n🎉 COMPLETE!`);
  console.log(`📊 Total rows: ${rowCount.toLocaleString()}`);
  console.log(`⏱️  Time taken: ${durationSeconds.toFixed(2)}s`);
  console.log(`🚀 Throughput: ${Math.round(rowCount / durationSeconds).toLocaleString()} rows/second`);
  
  return rowCount;
}

// Run the row counter
countRows("./measurements.txt")
  .then((totalRows) => {
    console.log(`\n✅ Final count: ${totalRows.toLocaleString()} rows`);
  })
  .catch(console.error);
