#!/usr/bin/env tsx

// Load environment variables first
import { config } from 'dotenv';
import path from 'path';

const result = config({ path: path.resolve(process.cwd(), '.env') });

if (result.error) {
  console.error('Failed to load .env file:', result.error);
} else {
  console.log('Environment loaded successfully from .env file');
  console.log('REDIS_URL exists:', !!process.env.REDIS_URL);
  console.log('REDIS_URL preview:', process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 20) + '...' : 'NOT FOUND');
}

console.log('Starting worker...');

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
