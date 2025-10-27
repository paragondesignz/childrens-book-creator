import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing API key');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testImageGeneration() {
  try {
    console.log('Testing Gemini 2.5 Flash Image with simple prompt...\n');
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        temperature: 0.4,
      },
    });

    console.log('Sending request...');
    const result = await model.generateContent([
      { text: 'Create a photograph of a happy child playing in a park.' }
    ]);
    
    const response = result.response;
    console.log('✓ Success! Response received');
    console.log('Candidates:', response.candidates?.length || 0);
    
    if (response.candidates && response.candidates[0]) {
      const parts = response.candidates[0].content.parts;
      console.log('Parts:', parts?.length || 0);
      
      for (const part of parts || []) {
        if (part.text) {
          console.log('Text part:', part.text.substring(0, 200));
        }
        if (part.inlineData) {
          console.log('Image part: Found');
        }
      }
    }
    
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testImageGeneration();
