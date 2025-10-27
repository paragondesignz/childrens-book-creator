import { createClient } from '@supabase/supabase-js';

async function makeBucketsPublic() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Making generated-pdfs and generated-images buckets public...');

  // Update generated-pdfs bucket
  const { data: data1, error: error1 } = await supabase
    .from('buckets')
    .update({ public: true })
    .eq('id', 'generated-pdfs')
    .select();

  if (error1) {
    console.error('Error updating generated-pdfs:', error1);
  } else {
    console.log('✓ generated-pdfs is now public');
  }

  // Update generated-images bucket
  const { data: data2, error: error2 } = await supabase
    .from('buckets')
    .update({ public: true })
    .eq('id', 'generated-images')
    .select();

  if (error2) {
    console.error('Error updating generated-images:', error2);
  } else {
    console.log('✓ generated-images is now public');
  }

  console.log('\nBuckets updated successfully! Images and PDFs should now load properly.');
}

makeBucketsPublic().catch(console.error);
