import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';
import { PDFGenerationService } from '../services/pdfGeneration.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function processStuckBook() {
  const bookId = '0226cf6d-1998-4733-8cc1-7b46697eb25b';

  console.log('[MANUAL] Processing stuck book:', bookId);

  // Check current state
  const { data: book } = await supabase
    .from('book_orders')
    .select('*, template:story_templates(*)')
    .eq('id', bookId)
    .single();

  if (!book) {
    console.error('Book not found!');
    return;
  }

  console.log('[MANUAL] Current status:', book.status);

  // Check story
  const { data: story } = await supabase
    .from('generated_stories')
    .select('id, title, story_pages(*)')
    .eq('book_order_id', bookId)
    .single();

  if (!story) {
    console.error('Story not found!');
    return;
  }

  console.log('[MANUAL] Story exists:', story.title);
  console.log('[MANUAL] Story pages:', story.story_pages.length);

  // Check images
  const { data: images, count } = await supabase
    .from('generated_images')
    .select('*', { count: 'exact' })
    .eq('book_order_id', bookId)
    .order('page_number', { ascending: true });

  console.log('[MANUAL] Images exist:', count);

  if (count !== 15) {
    console.error('Not all images generated!');
    return;
  }

  // Check PDF
  const { data: existingPdf } = await supabase
    .from('generated_pdfs')
    .select('*')
    .eq('book_order_id', bookId)
    .single();

  if (existingPdf) {
    console.log('[MANUAL] PDF already exists!', existingPdf.pdf_url);

    // Just mark as completed
    await supabase
      .from('book_orders')
      .update({
        status: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', bookId);

    console.log('[MANUAL] ✅ Book marked as completed!');
    return;
  }

  // Generate PDF
  console.log('[MANUAL] Generating PDF...');

  const pdfService = new PDFGenerationService();
  const pdfResult = await pdfService.generatePDF({
    bookOrderId: bookId,
    storyId: story.id,
    title: book.template?.title || `${book.child_first_name}'s Story`,
    pages: story.story_pages,
    images: images!,
  });

  console.log('[MANUAL] PDF generated:', pdfResult.pdf_url);

  // Mark as completed
  await supabase
    .from('book_orders')
    .update({
      status: 'completed',
      processing_completed_at: new Date().toISOString()
    })
    .eq('id', bookId);

  console.log('[MANUAL] ✅ Book completed successfully!');
}

processStuckBook().catch(error => {
  console.error('[MANUAL] ERROR:', error);
  process.exit(1);
});
