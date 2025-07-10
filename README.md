# 1br-tae

Tae's attempt at the 1 Billion Row Challenge in Bun/Typescript


## Testing

You can run it on a test file which only has 500 rows:

```
bun run main.ts test.txt
```

## Running on 1 billion rows:

### Step 1: Create the file with 1 billion rows

### NOTE: file is 13.8GB
1. Clone the repo: https://github.com/gunnarmorling/1brc
2. Install jdk (make sure it's v21): `brew install openjdk@21`
3. Add jdk is in your rc path, either .zshrc or .bashrc (instructions in installation output)
4. Run `./mvnw clean verify`
5. Run `./create_measurements_fast.sh 1000000000`
6. (optional) download one of the answers by running `./calculate_average_jerrinot.sh > result.txt`

### Step 2: Run the parser
```
bun main.ts measurements.txt
```

Current Best Run (Macbook Pro M4 48GB RAM):
🟢 COMPLETE! 🟢
• Total rows processed: 1,000,000,000
• Total time: 9.22s
• Average throughput: 108,511,229 rows/second
