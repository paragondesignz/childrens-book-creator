import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBooks() {
  const { data: books, error } = await supabase
    .from('book_orders')
    .select('id, child_first_name, status, processing_started_at, created_at, error_message')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== Recent Books ===\n');
  books?.forEach(book => {
    console.log(`Book ID: ${book.id}`);
    console.log(`  Name: ${book.child_first_name}`);
    console.log(`  Status: ${book.status}`);
    console.log(`  Created: ${new Date(book.created_at).toLocaleString()}`);
    console.log(`  Processing Started: ${book.processing_started_at ? new Date(book.processing_started_at).toLocaleString() : 'Not started'}`);
    if (book.error_message) {
      console.log(`  Error: ${book.error_message}`);
    }
    console.log('');
  });
}

checkBooks().catch(console.error);
