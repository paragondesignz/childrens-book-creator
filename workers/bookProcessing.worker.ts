import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { storyGenerationService } from '../services/storyGeneration.service';
import { imageGenerationService } from '../services/imageGeneration.service';
import { pdfGenerationService } from '../services/pdfGeneration.service';

const worker = new Worker(
  'book-processing',
  async (job) => {
    const { bookOrderId } = job.data;

    console.log(`Processing book order: ${bookOrderId}`);

    try {
      // Step 1: Generate story text
      console.log('Step 1: Generating story...');
      await storyGenerationService.generateStory(bookOrderId);
      await job.updateProgress(33);

      // Step 2: Generate images
      console.log('Step 2: Generating images...');
      await imageGenerationService.generateAllImages(bookOrderId);
      await job.updateProgress(66);

      // Step 3: Create PDF
      console.log('Step 3: Creating PDF...');
      await pdfGenerationService.generatePdf(bookOrderId);
      await job.updateProgress(100);

      console.log(`Book order ${bookOrderId} completed successfully`);

      // TODO: Send completion email to user

      return { success: true, bookOrderId };
    } catch (error) {
      console.error(`Error processing book order ${bookOrderId}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5, // Process up to 5 books simultaneously
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Book processing worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});
