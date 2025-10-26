import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCurrentBook() {
  // Get most recent processing book
  const { data: books } = await supabase
    .from('book_orders')
    .select('id, status, child_first_name, error_message, processing_started_at')
    .in('status', ['processing', 'generating-story', 'generating-images', 'creating-pdf'])
    .order('processing_started_at', { ascending: false })
    .limit(1);

  if (!books || books.length === 0) {
    console.log('No books currently processing');

    // Check most recent book regardless of status
    const { data: recentBooks } = await supabase
      .from('book_orders')
      .select('id, status, child_first_name, error_message, processing_started_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentBooks && recentBooks.length > 0) {
      console.log('\nMost recent book:', JSON.stringify(recentBooks[0], null, 2));
      await checkBookDetails(recentBooks[0].id);
    }
    return;
  }

  const book = books[0];
  console.log('Current processing book:', JSON.stringify(book, null, 2));
  await checkBookDetails(book.id);
}

async function checkBookDetails(bookId: string) {
  // Check images
  const { data: images, count } = await supabase
    .from('generated_images')
    .select('page_number, image_url, thumbnail_url', { count: 'exact' })
    .eq('book_order_id', bookId)
    .order('page_number', { ascending: true });

  console.log('\nImages generated:', count);
  if (images && images.length > 0) {
    console.log('Sample URLs:');
    console.log('  Page 1:', images[0].image_url);
    if (images.length > 1) {
      console.log('  Page', images.length, ':', images[images.length - 1].image_url);
    }
  }

  // Check PDF
  const { data: pdf } = await supabase
    .from('generated_pdfs')
    .select('*')
    .eq('book_order_id', bookId)
    .single();

  console.log('\nPDF exists:', !!pdf);
  if (pdf) {
    console.log('PDF URL:', pdf.pdf_url);
    console.log('PDF size:', pdf.file_size_bytes, 'bytes');
  }

  // Check story
  const { data: story } = await supabase
    .from('generated_stories')
    .select('id, title')
    .eq('book_order_id', bookId)
    .single();

  console.log('\nStory exists:', !!story);
  if (story) {
    console.log('Story title:', story.title);
  }
}

checkCurrentBook();
