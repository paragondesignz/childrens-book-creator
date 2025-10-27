import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing API key');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testStoryGeneration() {
  try {
    console.log('Testing story generation with Gemini 2.5 Flash...\n');
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Write a 10-page children's story for Emma, a 6-year-old child.

Story Template: Adventure Story
A magical adventure story

Child's Information:
- Name: Emma
- Age: 6 years old

Requirements:
- Age-appropriate language for 6-year-olds
- Positive, encouraging themes
- Emma should be the protagonist and hero of the story
- Story must be exactly 10 pages
- Each page should have 50-100 words
- Include engaging dialogue
- Educational elements appropriate for the age
- Safe, positive resolution
- No scary or frightening content

Return the story as JSON with this exact structure:
{
  "title": "The story title here",
  "pages": [
    {
      "pageNumber": 1,
      "text": "The text for this page (50-100 words)",
      "imagePrompt": "Detailed visual scene description showing Emma - describe the setting, action, and atmosphere WITHOUT using words like 'illustration' or 'drawing'"
    }
  ]
}`;

    console.log('Sending story generation request...');
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    console.log('✓ Story generated!');
    console.log('Response length:', text.length, 'characters');
    
    // Try to parse
    const storyData = JSON.parse(text);
    console.log('✓ Valid JSON');
    console.log('Title:', storyData.title);
    console.log('Pages:', storyData.pages?.length || 0);
    
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.substring(0, 500));
    }
  }
}

testStoryGeneration();
