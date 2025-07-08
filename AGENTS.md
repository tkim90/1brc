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