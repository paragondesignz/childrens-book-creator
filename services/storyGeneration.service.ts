import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization to ensure environment variables are loaded
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Lazy initialization for Gemini
function getGemini() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenerativeAI(apiKey);
}

interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
}

interface GeneratedStoryData {
  title: string;
  pages: StoryPage[];
}

interface GenerateStoryParams {
  bookOrderId: string;
  templateId?: string;
  childFirstName: string;
  childAge: number;
  childGender?: string;
  favouriteColours: string[];
  interests: string[];
  personalityTraits: string[];
  customPrompt?: string;
  pets: any[];
}

export class StoryGenerationService {
  async generateStory(params: GenerateStoryParams): Promise<any> {
    const { bookOrderId, templateId } = params;

    try {
      const supabase = getSupabase();

      // Fetch template if provided
      let template = null;
      if (templateId) {
        const { data } = await supabase
          .from('story_templates')
          .select('*')
          .eq('id', templateId)
          .single();
        template = data;
      }

      // Build prompt
      const prompt = this.buildPrompt(params, template);

      console.log('Generating story with Gemini 2.5 Flash...');

      // Generate story with Gemini 2.5 Flash
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const storyData: GeneratedStoryData = JSON.parse(text);

      // Validate story data
      if (!storyData.title || !storyData.pages || storyData.pages.length !== 10) {
        throw new Error(`Invalid story data received from Gemini: expected 10 pages, got ${storyData.pages?.length || 0}`);
      }

      // Save to database
      const { data: generatedStory, error: storyError } = await supabase
        .from('generated_stories')
        .insert({
          book_order_id: bookOrderId,
          title: storyData.title,
          full_story_json: storyData, // Store full JSON structure
          word_count: this.calculateWordCount(storyData.pages),
          generation_prompt: prompt,
          content_moderation_passed: false,
          moderation_flags: {},
        })
        .select()
        .single();

      if (storyError || !generatedStory) {
        throw new Error('Failed to save story to database');
      }

      // Create story pages
      const pagesData = storyData.pages.map((page) => ({
        story_id: generatedStory.id,
        page_number: page.pageNumber,
        page_text: page.text,
        image_prompt: page.imagePrompt,
        word_count: page.text.split(/\s+/).length,
      }));

      const { error: pagesError } = await supabase
        .from('story_pages')
        .insert(pagesData);

      if (pagesError) {
        throw new Error('Failed to save story pages');
      }

      console.log(`Story generated successfully: ${storyData.title}`);

      return {
        id: generatedStory.id,
        title: storyData.title,
        pages: storyData.pages,
      };
    } catch (error) {
      console.error('Story generation error:', error);
      throw error;
    }
  }

  private buildPrompt(params: GenerateStoryParams, template: any): string {
    const { childFirstName, childAge, childGender, favouriteColours, interests, personalityTraits, customPrompt, pets } = params;

    let prompt = `Write a 10-page children's story for ${childFirstName}, a ${childAge}-year-old child.\n\n`;

    if (template) {
      prompt += `Story Template: ${template.title}\n`;
      prompt += `${template.description}\n\n`;
    } else if (customPrompt) {
      prompt += `Custom Story Idea: ${customPrompt}\n\n`;
    }

    prompt += `Child's Information:\n`;
    prompt += `- Name: ${childFirstName}\n`;
    prompt += `- Age: ${childAge} years old\n`;
    if (childGender) prompt += `- Gender: ${childGender}\n`;
    if (interests?.length) prompt += `- Interests: ${interests.join(', ')}\n`;
    if (favouriteColours?.length) prompt += `- Favourite Colours: ${favouriteColours.join(', ')}\n`;
    if (personalityTraits?.length) prompt += `- Personality: ${personalityTraits.join(', ')}\n`;

    if (pets.length > 0) {
      prompt += `\nPets to include in the story:\n`;
      pets.forEach((pet: any) => {
        prompt += `- ${pet.pet_name}, a ${pet.colour || ''} ${pet.pet_type}${pet.breed ? ` (${pet.breed})` : ''}\n`;
      });
    }

    prompt += `\nRequirements:\n`;
    prompt += `- Age-appropriate language for ${childAge}-year-olds\n`;
    prompt += `- Positive, encouraging themes\n`;
    prompt += `- ${childFirstName} should be the protagonist and hero of the story\n`;
    prompt += `- Story must be exactly 10 pages\n`;
    prompt += `- Each page should have 50-100 words\n`;
    prompt += `- Include engaging dialogue\n`;
    prompt += `- Educational elements appropriate for the age\n`;
    prompt += `- Safe, positive resolution\n`;
    prompt += `- No scary or frightening content\n\n`;

    prompt += `Return the story as JSON with this exact structure:\n`;
    prompt += `{\n`;
    prompt += `  "title": "The story title here",\n`;
    prompt += `  "pages": [\n`;
    prompt += `    {\n`;
    prompt += `      "pageNumber": 1,\n`;
    prompt += `      "text": "The text for this page (50-100 words)",\n`;
    prompt += `      "imagePrompt": "Detailed visual scene description showing ${childFirstName} - describe the setting, action, and atmosphere WITHOUT using words like 'illustration' or 'drawing'"\n`;
    prompt += `    }\n`;
    prompt += `  ]\n`;
    prompt += `}`;

    return prompt;
  }

  private calculateWordCount(pages: StoryPage[]): number {
    return pages.reduce((total, page) => {
      return total + page.text.split(/\s+/).length;
    }, 0);
  }
}

export const storyGenerationService = new StoryGenerationService();
