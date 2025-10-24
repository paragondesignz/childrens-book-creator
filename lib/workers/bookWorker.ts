// Load environment variables first
import { config } from 'dotenv';
config();

import { Worker, Job } from 'bullmq';
import { getBullMQConnectionConfig } from '@/lib/redis';
import { createClient } from '@supabase/supabase-js';
import { StoryGenerationService } from '@/services/storyGeneration.service';
import { ImageGenerationService } from '@/services/imageGeneration.service';
import { PDFGenerationService } from '@/services/pdfGeneration.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface BookJobData {
  bookOrderId: string;
  userId: string;
}

async function processBook(job: Job<BookJobData>) {
  const { bookOrderId, userId } = job.data;
  
  console.log(`Starting book processing for order: ${bookOrderId}`);
  
  // Create Supabase client with service role for server-side operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch book order data
    const { data: bookOrder, error: fetchError } = await supabase
      .from('book_orders')
      .select(`
        *,
        template:story_templates(*),
        pets:book_pets(*)
      `)
      .eq('id', bookOrderId)
      .single();

    if (fetchError || !bookOrder) {
      throw new Error('Failed to fetch book order');
    }

    // Update progress
    await job.updateProgress(10);

    // Step 1: Generate Story
    console.log('Generating story...');
    await supabase
      .from('book_orders')
      .update({ status: 'generating-story' })
      .eq('id', bookOrderId);

    const storyService = new StoryGenerationService();
    const generatedStory = await storyService.generateStory({
      bookOrderId,
      templateId: bookOrder.template_id,
      childFirstName: bookOrder.child_first_name,
      childAge: bookOrder.child_age,
      childGender: bookOrder.child_gender,
      favouriteColours: bookOrder.favourite_colours || [],
      interests: bookOrder.interests || [],
      personalityTraits: bookOrder.personality_traits || [],
      customPrompt: bookOrder.custom_story_prompt,
      pets: bookOrder.pets || [],
    });

    await job.updateProgress(40);

    // Step 2: Generate Images
    console.log('Generating images...');
    await supabase
      .from('book_orders')
      .update({ status: 'generating-images' })
      .eq('id', bookOrderId);

    const imageService = new ImageGenerationService();
    const generatedImages = await imageService.generateImagesForStory({
      storyId: generatedStory.id,
      bookOrderId,
      pages: generatedStory.pages,
      illustrationStyle: bookOrder.illustration_style,
      childFirstName: bookOrder.child_first_name,
    });

    await job.updateProgress(70);

    // Step 3: Generate PDF
    console.log('Creating PDF...');
    await supabase
      .from('book_orders')
      .update({ status: 'creating-pdf' })
      .eq('id', bookOrderId);

    const pdfService = new PDFGenerationService();
    const pdfResult = await pdfService.generatePDF({
      bookOrderId,
      storyId: generatedStory.id,
      title: bookOrder.template?.title || `${bookOrder.child_first_name}'s Story`,
      pages: generatedStory.pages,
      images: generatedImages,
    });

    await job.updateProgress(90);

    // Step 4: Mark as completed
    console.log('Finalizing...');
    await supabase
      .from('book_orders')
      .update({ status: 'completed' })
      .eq('id', bookOrderId);

    await job.updateProgress(100);

    console.log(`Book processing completed for order: ${bookOrderId}`);
    
    return {
      success: true,
      bookOrderId,
      pdfId: pdfResult.id,
    };
  } catch (error: any) {
    console.error('Book processing failed:', error);
    
    // Update status to failed
    await supabase
      .from('book_orders')
      .update({ 
        status: 'failed',
        error_message: error.message || 'Unknown error occurred'
      })
      .eq('id', bookOrderId);

    throw error;
  }
}

// Create and export the worker
export const bookWorker = new Worker<BookJobData>(
  'book-processing',
  async (job) => {
    return await processBook(job);
  },
  {
    connection: getBullMQConnectionConfig(),
    concurrency: 2, // Process up to 2 books simultaneously
    limiter: {
      max: 5, // Maximum 5 jobs
      duration: 60000, // Per minute (to respect API rate limits)
    },
  }
);

bookWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

bookWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});

bookWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Book processing worker started');
