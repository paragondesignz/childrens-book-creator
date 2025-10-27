const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  try {
    const bookId = 'c16b6625-f0b5-4bf1-aeaf-b4dbf18ac425';
    const { data: photo } = await supabase
      .from('uploaded_images')
      .select('storage_url')
      .eq('book_order_id', bookId)
      .eq('image_type', 'child_photo')
      .single();
      
    if (!photo || !photo.storage_url) {
      console.log('No photo found');
      return;
    }
    
    console.log('Photo URL:', photo.storage_url);
    console.log('\nTesting HTTP access...');
    
    const response = await axios.head(photo.storage_url);
    console.log('✓ URL is accessible');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content-Length:', response.headers['content-length']);
    
    console.log('\nTrying to download...');
    const downloadResponse = await axios.get(photo.storage_url, { responseType: 'arraybuffer' });
    console.log('✓ Downloaded successfully');
    console.log('Size:', downloadResponse.data.length, 'bytes');
    console.log('Type:', downloadResponse.headers['content-type']);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
})();
