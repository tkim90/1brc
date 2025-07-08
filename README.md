# 1br-tae

Tae's attempt at the 1 Billion Row Challenge in Bun/Typescript

### Step 1: Create the file with 1 billion rows

# NOTE: file is 13.8GB
1. Go to https://github.com/gunnarmorling/1brc
2. Clone the repo
3. `brew install openjdk@21`
4. Make sure jdk is in your path, either .zshrc or .bashrc
5. `./mvnw clean verify`
6. `./create_measurements_fast.sh 1000000000`
7. (optional) download one of the answers by running `./calculate_average_jerrinot.sh > result.txt`

Current Best Run:
📊 Total rows processed: 1,000,000,000
⏱️  Total time: 20.77s
🚀 Average throughput: 48,135,658 rows/second
💾 Data throughput: 633.29 MB/s