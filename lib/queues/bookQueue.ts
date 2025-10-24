import { Queue } from 'bullmq';
import { getBullMQConnectionConfig } from '@/lib/redis';

// Create queue lazily to avoid connection issues in serverless environments
let queueInstance: Queue | null = null;

export const getBookQueue = (): Queue => {
  if (!queueInstance) {
    queueInstance = new Queue('book-processing', {
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
  }
  return queueInstance;
};

// For backward compatibility
export const bookQueue = new Proxy({} as Queue, {
  get(target, prop) {
    return getBookQueue()[prop as keyof Queue];
  }
});
