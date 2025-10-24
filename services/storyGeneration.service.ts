import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  private model = genAI.getGenerativeModel({
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp',
  });

  async generateStory(params: GenerateStoryParams): Promise<any> {
    const { bookOrderId, templateId } = params;

    try {
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

      console.log('Generating story with Gemini...');

      // Generate story with Gemini
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
          topP: 0.95,
          topK: 40,
          responseMimeType: 'application/json',
        },
      });

      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const storyData: GeneratedStoryData = JSON.parse(text);

      // Validate story data
      if (!storyData.title || !storyData.pages || storyData.pages.length !== 15) {
        throw new Error('Invalid story data received from Gemini');
      }

      // Prepare full text
      const fullText = storyData.pages.map(p => p.text).join('\n\n');

      // Save to database
      const { data: generatedStory, error: storyError } = await supabase
        .from('generated_stories')
        .insert({
          book_order_id: bookOrderId,
          title: storyData.title,
          full_text: fullText,
          page_count: storyData.pages.length,
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

    let prompt = `Write a 15-page children's story for ${childFirstName}, a ${childAge}-year-old child.\n\n`;

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
    prompt += `- Story must be exactly 15 pages\n`;
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
    prompt += `      "imagePrompt": "Detailed description for illustration showing ${childFirstName}..."\n`;
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
