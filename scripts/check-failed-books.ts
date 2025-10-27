import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFailedBooks() {
  const { data, error } = await supabase
    .from('book_orders')
    .select('id, status, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent book orders:');
  data?.forEach(book => {
    console.log(`\n[${book.id}]`);
    console.log(`  Status: ${book.status}`);
    console.log(`  Created: ${book.created_at}`);
    if (book.error_message) {
      console.log(`  Error: ${book.error_message}`);
    }
  });
}

checkFailedBooks().catch(console.error);
