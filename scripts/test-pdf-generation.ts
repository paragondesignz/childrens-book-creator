import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';
import { PDFGenerationService } from '../services/pdfGeneration.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPDFGeneration() {
  try {
    const bookId = '67e5bab3-199a-44ed-9dad-64d50f402cea';

    console.log('[TEST] Fetching book data...');

    // Get story
    const { data: story, error: storyError } = await supabase
      .from('generated_stories')
      .select('*')
      .eq('book_order_id', bookId)
      .single();

    if (storyError || !story) {
      throw new Error(`Failed to fetch story: ${storyError?.message}`);
    }

    // Get story pages
    const { data: storyPages, error: pagesError } = await supabase
      .from('story_pages')
      .select('*')
      .eq('story_id', story.id)
      .order('page_number', { ascending: true });

    if (pagesError || !storyPages) {
      throw new Error(`Failed to fetch story pages: ${pagesError?.message}`);
    }

    // Get images
    const { data: images, error: imagesError } = await supabase
      .from('generated_images')
      .select('*')
      .eq('book_order_id', bookId)
      .order('page_number', { ascending: true });

    if (imagesError) {
      throw new Error(`Failed to fetch images: ${imagesError?.message}`);
    }

    console.log('[TEST] Data fetched successfully:');
    console.log(`  - Story title: ${story.title}`);
    console.log(`  - Story pages: ${storyPages.length}`);
    console.log(`  - Images: ${images?.length || 0}`);

    console.log('[TEST] Starting PDF generation...');

    // Try to generate PDF
    const pdfService = new PDFGenerationService();
    const result = await pdfService.generatePDF({
      bookOrderId: bookId,
      storyId: story.id,
      title: story.title,
      pages: storyPages,
      images: images || []
    });

    console.log('[TEST] ✅ PDF generated successfully!');
    console.log(`  - PDF ID: ${result.id}`);
    console.log(`  - PDF URL: ${result.pdf_url}`);

    // Update book status
    await supabase
      .from('book_orders')
      .update({
        status: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', bookId);

    console.log('[TEST] ✅ Book marked as completed!');

  } catch (error: any) {
    console.error('[TEST] ❌ PDF Generation Error:');
    console.error(`  Message: ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack}`);
    }
    if (error.cause) {
      console.error(`  Cause: ${JSON.stringify(error.cause, null, 2)}`);
    }
  }
}

testPDFGeneration();
