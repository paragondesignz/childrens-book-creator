import { Queue } from 'bullmq';
import { getBullMQConnectionConfig } from '@/lib/redis';

export const bookQueue = new Queue('book-processing', {
  connection: getBullMQConnectionConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});
