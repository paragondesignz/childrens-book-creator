import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GenerateImagesParams {
  storyId: string;
  bookOrderId: string;
  pages: any[];
  illustrationStyle: string;
  childFirstName: string;
}

export class ImageGenerationService {
  private model = genAI.getGenerativeModel({
    model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash',
  });

  async generateImagesForStory(params: GenerateImagesParams): Promise<any[]> {
    const { storyId, bookOrderId, pages, illustrationStyle, childFirstName } = params;

    try {
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
      const prompt = this.buildImagePrompt(storyPage, illustrationStyle, childFirstName);

      console.log(`Generating image for page ${storyPage.page_number}...`);

      // Create a simple placeholder image with Sharp
      // TODO: Replace with actual Gemini image generation when API is available
      const placeholderImage = await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 4,
          background: { r: 240, g: 240, b: 255, alpha: 1 }
        }
      })
        .composite([{
          input: Buffer.from(`
            <svg width="1024" height="1024">
              <rect width="1024" height="1024" fill="#f0f0ff"/>
              <text x="512" y="400" font-family="Arial" font-size="32" text-anchor="middle" fill="#333">
                Page ${storyPage.page_number}
              </text>
              <text x="512" y="450" font-family="Arial" font-size="20" text-anchor="middle" fill="#666">
                ${childFirstName}'s Adventure
              </text>
              <text x="512" y="550" font-family="Arial" font-size="16" text-anchor="middle" fill="#999">
                Illustration Placeholder
              </text>
            </svg>
          `),
          top: 0,
          left: 0,
        }])
        .png()
        .toBuffer();

      // Generate thumbnail
      const thumbnail = await sharp(placeholderImage)
        .resize(256, 256)
        .toBuffer();

      // Upload to Supabase Storage
      const imagePath = `${bookOrderId}/page-${storyPage.page_number}.png`;
      const thumbnailPath = `${bookOrderId}/page-${storyPage.page_number}-thumb.png`;

      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(imagePath, placeholderImage, {
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

    let prompt = `Generate a children's book illustration in ${illustrationStyle} style.\n\n`;
    prompt += `Style guide: ${styleGuide}\n\n`;
    prompt += `CRITICAL: This illustration must show ${childFirstName}.\n`;
    prompt += `Character consistency is essential - maintain the same appearance throughout.\n\n`;
    prompt += `Scene description: ${storyPage.image_prompt}\n\n`;
    prompt += `Requirements:\n`;
    prompt += `- Professional children's book quality\n`;
    prompt += `- Safe, age-appropriate content\n`;
    prompt += `- No scary or frightening elements\n`;
    prompt += `- Bright, inviting colors\n`;
    prompt += `- 1024x1024 resolution\n`;
    prompt += `- Suitable for printing at 300 DPI\n`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
