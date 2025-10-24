import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';
import type { BookConfiguration, GeneratedStoryData, StoryPage } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class StoryGenerationService {
  private model = genAI.getGenerativeModel({
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash',
  });

  async generateStory(bookOrderId: string): Promise<void> {
    try {
      // Update status
      await db.bookOrder.update({
        where: { id: bookOrderId },
        data: { status: 'generating-story', processingStartedAt: new Date() },
      });

      // Get book order details
      const bookOrder = await db.bookOrder.findUnique({
        where: { id: bookOrderId },
        include: { template: true, pets: true },
      });

      if (!bookOrder) {
        throw new Error('Book order not found');
      }

      // Build prompt
      const prompt = this.buildPrompt(bookOrder);

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

      // Save to database
      const generatedStory = await db.generatedStory.create({
        data: {
          bookOrderId,
          title: storyData.title,
          fullStoryJson: storyData as any,
          wordCount: this.calculateWordCount(storyData.pages),
          generationPrompt: prompt,
          contentModerationPassed: false, // Will be checked separately
          moderationFlags: {},
        },
      });

      // Create story pages
      for (const page of storyData.pages) {
        await db.storyPage.create({
          data: {
            storyId: generatedStory.id,
            pageNumber: page.pageNumber,
            pageText: page.text,
            imagePrompt: page.imagePrompt,
            wordCount: page.text.split(/\s+/).length,
          },
        });
      }

      console.log(`Story generated successfully: ${storyData.title}`);
    } catch (error) {
      console.error('Story generation error:', error);
      await db.bookOrder.update({
        where: { id: bookOrderId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private buildPrompt(bookOrder: any): string {
    const template = bookOrder.template;
    const childInfo = {
      firstName: bookOrder.childFirstName,
      age: bookOrder.childAge,
      gender: bookOrder.childGender,
      favouriteColours: bookOrder.favouriteColours,
      interests: bookOrder.interests,
      personalityTraits: bookOrder.personalityTraits,
    };
    const pets = bookOrder.pets || [];

    let prompt = `Write a 15-page children's story for ${childInfo.firstName}, a ${childInfo.age}-year-old child.\n\n`;

    if (template) {
      prompt += `Story Template: ${template.title}\n`;
      prompt += `${template.description}\n\n`;
    } else if (bookOrder.customStoryPrompt) {
      prompt += `Custom Story Idea: ${bookOrder.customStoryPrompt}\n\n`;
    }

    prompt += `Child's Information:\n`;
    prompt += `- Name: ${childInfo.firstName}\n`;
    prompt += `- Age: ${childInfo.age} years old\n`;
    if (childInfo.gender) prompt += `- Gender: ${childInfo.gender}\n`;
    if (childInfo.interests?.length) prompt += `- Interests: ${childInfo.interests.join(', ')}\n`;
    if (childInfo.favouriteColours?.length) prompt += `- Favourite Colours: ${childInfo.favouriteColours.join(', ')}\n`;
    if (childInfo.personalityTraits?.length) prompt += `- Personality: ${childInfo.personalityTraits.join(', ')}\n`;

    if (pets.length > 0) {
      prompt += `\nPets to include in the story:\n`;
      pets.forEach((pet: any) => {
        prompt += `- ${pet.petName}, a ${pet.colour || ''} ${pet.petType}${pet.breed ? ` (${pet.breed})` : ''}\n`;
      });
    }

    prompt += `\nRequirements:\n`;
    prompt += `- Age-appropriate language for ${childInfo.age}-year-olds\n`;
    prompt += `- Positive, encouraging themes\n`;
    prompt += `- ${childInfo.firstName} should be the protagonist and hero of the story\n`;
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
    prompt += `      "imagePrompt": "Detailed description for illustration showing ${childInfo.firstName}..."\n`;
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
