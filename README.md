# 1br-tae

# Create the file with 1 billion rows
# NOTE: file is 13.8GB
1. Go to https://github.com/gunnarmorling/1brc
2. Clone the repo
3. `brew install openjdk@21`
4. Make sure jdk is in your path, either .zshrc or .bashrc
5. `./mvnw clean verify`
6. `./create_measurements_fast.sh 1000000000`

measurements.txt
📊 Total rows: 999,991,941
💾 Size: 13.8 GB