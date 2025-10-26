import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Lazy initialization to ensure environment variables are loaded
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface GenerateImagesParams {
  storyId: string;
  bookOrderId: string;
  pages: any[];
  illustrationStyle: string;
  childFirstName: string;
}

export class ImageGenerationService {
  // Use gemini-2.5-flash-image for text rendering capabilities
  private model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
  });

  async generateImagesForStory(params: GenerateImagesParams): Promise<any[]> {
    const { storyId, bookOrderId, pages, illustrationStyle, childFirstName } = params;

    try {
      const supabase = getSupabase();
      console.log(`Generating images for ${pages.length} pages...`);

      // Fetch story pages from database to get IDs
      const { data: storyPages, error } = await supabase
        .from('story_pages')
        .select('*')
        .eq('story_id', storyId)
        .order('page_number', { ascending: true });

      if (error || !storyPages) {
        throw new Error('Failed to fetch story pages');
      }

      const generatedImages = [];

      // Generate images in batches of 3 to avoid rate limits
      const batchSize = 3;
      for (let i = 0; i < storyPages.length; i += batchSize) {
        const batch = storyPages.slice(i, i + batchSize);
        const batchPromises = batch.map((page) =>
          this.generateImage({
            bookOrderId,
            storyPage: page,
            illustrationStyle,
            childFirstName,
          })
        );
        const batchResults = await Promise.all(batchPromises);
        generatedImages.push(...batchResults);

        console.log(`Generated images ${i + 1}-${Math.min(i + batchSize, storyPages.length)} of ${storyPages.length}`);
      }

      console.log('All images generated successfully');
      return generatedImages;
    } catch (error) {
      console.error('Image generation error:', error);
      throw error;
    }
  }

  private async generateImage(params: {
    bookOrderId: string;
    storyPage: any;
    illustrationStyle: string;
    childFirstName: string;
  }): Promise<any> {
    const { bookOrderId, storyPage, illustrationStyle, childFirstName } = params;

    try {
      const supabase = getSupabase();
      const prompt = this.buildImagePrompt(storyPage, illustrationStyle, childFirstName);

      console.log(`Generating image for page ${storyPage.page_number}...`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate image with Gemini
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 32,
        },
      });

      const response = await result.response;

      // Extract image from response
      // Gemini returns images as base64 in the response
      const imagePart = response.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData);

      if (!imagePart?.inlineData?.data) {
        throw new Error('No image data received from Gemini');
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

      // Generate thumbnail
      const thumbnail = await sharp(imageBuffer)
        .resize(256, 256)
        .toBuffer();

      // Upload to Supabase Storage
      const imagePath = `${bookOrderId}/page-${storyPage.page_number}.png`;
      const thumbnailPath = `${bookOrderId}/page-${storyPage.page_number}-thumb.png`;

      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(imagePath, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: thumbUploadError } = await supabase.storage
        .from('generated-images')
        .upload(thumbnailPath, thumbnail, {
          contentType: 'image/png',
          upsert: true,
        });

      if (thumbUploadError) {
        throw thumbUploadError;
      }

      // Get public URLs
      const { data: { publicUrl: imageUrl } } = supabase.storage
        .from('generated-images')
        .getPublicUrl(imagePath);

      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from('generated-images')
        .getPublicUrl(thumbnailPath);

      // Save to database
      const { data: generatedImage, error: dbError } = await supabase
        .from('generated_images')
        .insert({
          book_order_id: bookOrderId,
          story_page_id: storyPage.id,
          page_number: storyPage.page_number,
          image_url: imageUrl,
          thumbnail_url: thumbnailUrl,
          generation_prompt: prompt,
          width: 1024,
          height: 1024,
          content_moderation_passed: false,
          moderation_flags: {},
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      console.log(`Image generated for page ${storyPage.page_number}`);
      return generatedImage;
    } catch (error) {
      console.error(`Error generating image for page ${storyPage.page_number}:`, error);
      throw error;
    }
  }

  private buildImagePrompt(storyPage: any, illustrationStyle: string, childFirstName: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'Soft watercolor style with gentle brush strokes and translucent colors',
      'digital-art': 'Modern digital art style with vibrant colors and smooth gradients',
      'cartoon': 'Fun cartoon style with bold outlines and bright, cheerful colors',
      'storybook-classic': 'Classic storybook illustration style, timeless and warm',
      'modern-minimal': 'Clean, modern minimal style with simple shapes and soft colors',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    let prompt = `Create a professional children's book page in ${illustrationStyle} style.\n\n`;

    prompt += `STORY TEXT TO INCLUDE:\n`;
    prompt += `"${storyPage.page_text}"\n\n`;

    prompt += `Please render this text directly on the illustration with professional children's book graphic design. Choose the best font, size, color, placement, and styling to make it beautiful and readable. The text and illustration should work together harmoniously like a professionally designed picture book.\n\n`;

    prompt += `ILLUSTRATION STYLE: ${styleGuide}\n\n`;

    prompt += `SCENE: ${storyPage.image_prompt}\n`;
    prompt += `The illustration must show ${childFirstName}. Maintain consistent character appearance throughout.\n\n`;

    prompt += `REQUIREMENTS:\n`;
    prompt += `- Professional children's book quality\n`;
    prompt += `- Safe, age-appropriate content\n`;
    prompt += `- Bright, inviting colors\n`;
    prompt += `- Square format (1024x1024)\n`;
    prompt += `- High quality suitable for printing at 300 DPI\n`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
