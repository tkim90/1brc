# AGENTS.md - Development Guidelines

## Build/Run Commands
- **Run main program**: `bun run main.ts <filename>` (e.g., `bun run main.ts test.txt` or `bun run main.ts measurements.txt`)
- **Run TypeScript files**: `bun run <filename>.ts`
- **Type checking**: `bun tsc --noEmit` (no dedicated typecheck script)
- **No test framework configured** - verify functionality by running against test.txt and measurements.txt

## Code Style Guidelines
- **Runtime**: Bun project - use `bun` commands, not `npm`
- **TypeScript**: Strict mode enabled with ESNext target
- **Imports**: Use Node.js style imports (`import * as fs from "fs"`)
- **Types**: Define interfaces for data structures (StationStats, WorkerResult, WorkerData)
- **Naming**: camelCase for variables/functions, PascalCase for interfaces, UPPER_CASE for constants
- **Error handling**: Use try/catch blocks, log errors with descriptive messages and emojis
- **Performance**: Optimize for high-throughput file processing (large buffers, minimal logging in hot loops)
- **Comments**: Use JSDoc for functions, inline comments for complex logic
- **Formatting**: 2-space indentation, semicolons required

## Architecture Notes
- Multi-threaded worker pattern for parallel file processing
- Line-boundary aligned chunking to prevent data corruption
- Statistics aggregation using Maps for performance
- File I/O optimized with large buffers (24MB) and proper stream handling

## Cursor Rules
This is a Bun project. Use bun terminal commands.

# Goal

The goal is to write a program that can parse a large file in under 20 seconds and get for each station the min, max, and average value for each station. 

# Sample Inputs and Outputs

The input file has two columns, weather station name and a weather reading.
Every new line is a station reading.
`;` separates the two columns.

<sample_input>
Tel Aviv;33.9
Dhaka;36.9
Baghdad;29.3
Ndola;37.2
Nakhon Ratchasima;30.7
</sample_input>

<sample_output>
{Abha=-32.2/18.0/67.2, 
Abidjan=-23.6/26.0/79.6, 
Abéché=-22.9/29.4/82.2, 
Accra=-23.4/26.4/75.5, 
Addis Ababa=-37.9/16.0/64.6, 
Adelaide=-32.0/17.3/67.3, 
Aden=-19.9/29.1/78.7, 
Ahvaz=-27.1/25.4/77.5, 
Albuquerque=-35.2/14.0/62.1, 
Alexandra=-37.9/11.0/57.2, 
Alexandria=-29.4/20.0/74.8,
...
}
</sample_output>


# Files

Focus on 4-aggregate.ts and 4-worker.ts files as the core program.

`measurements.txt` is a 13.8GB file that we want to parse.
`test.txt` is a smaller version of that file for testing.

# Running the program

To run the program, do `bun run 4-aggregate.ts measurements.txt` or `bun run 4-aggregate.ts test.txt`.

