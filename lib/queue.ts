import { Queue } from 'bullmq';
import { redis } from './redis';

export const bookProcessingQueue = new Queue('book-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 500,
    },
  },
});

export async function addBookProcessingJob(bookOrderId: string) {
  await bookProcessingQueue.add(
    'generate-book',
    { bookOrderId },
    {
      jobId: bookOrderId,
    }
  );
}
