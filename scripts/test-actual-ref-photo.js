const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function urlToBase64(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  const base64 = buffer.toString('base64');
  return {
    inlineData: {
      data: base64,
      mimeType: response.headers['content-type'] || 'image/jpeg'
    }
  };
}

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
      console.log('No reference photo found');
      return;
    }
    
    console.log('Found reference photo');
    console.log('URL:', photo.storage_url.substring(0, 80) + '...');
    console.log('\nFetching...');
    
    const refImage = await urlToBase64(photo.storage_url);
    console.log('✓ Converted to base64\n');
    
    console.log('Testing startChat with reference image...');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: { temperature: 0.4 },
    });
    
    const chat = model.startChat({ history: [] });
    
    const messageParts = [
      refImage,
      { text: 'Create a photograph of the person in this image playing in a park.' }
    ];
    
    const result = await chat.sendMessage(messageParts);
    console.log('✓ SUCCESS!');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
})();
