#!/usr/bin/env tsx

// Import the worker to start it
import '../lib/workers/bookWorker';

console.log('Worker process started. Waiting for jobs...');

// Keep the process running
process.on('SIGINT', () => {
  console.log('\nShutting down worker gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down worker gracefully...');
  process.exit(0);
});
