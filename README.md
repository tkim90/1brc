# 1br-tae

Tae's attempt at the 1 Billion Row Challenge in Bun/Typescript

Current Best Run (Macbook Pro M4 48GB RAM) - ***9.22s***:

```
🟢 COMPLETE! 🟢
- Total rows processed: 1,000,000,000
- Total time: 9.22s
- Average throughput: 108,511,229 rows/second
```

## Instructions

### Step 1: Create the file with 1 billion rows

1. Clone the repo: https://github.com/gunnarmorling/1brc
2. Install jdk (make sure it's v21): `brew install openjdk@21`
3. Add jdk is in your rc path, either .zshrc or .bashrc (instructions in installation output)
4. Run `./mvnw clean verify`
5. Run `./create_measurements_fast.sh 1000000000`
    _NOTE: file is 13.8GB, make sure you have enough space_
7. (optional) download one of the answers by running `./calculate_average_jerrinot.sh > result.txt`

### Step 2: Run the parser
1. Install deps with `npm install`
2. Run the parser, either bun or nodejs:


## Run it on a test file first

You can run it on a test file which only has 500 rows:

```
npm run bun test.txt
OR
npm run node test.txt
```

## Run it on measurements.txt (the 13.8GB file)
```
npm run bun measurements.txt
OR
npm run node measurements.txt
```

