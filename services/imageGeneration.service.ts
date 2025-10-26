import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Configure Fal.ai
fal.config({
  credentials: process.env.FAL_API_KEY,
});

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

  async generateFrontCover(params: {
    bookOrderId: string;
    storyTitle: string;
    childFirstName: string;
    illustrationStyle: string;
  }): Promise<any> {
    const { bookOrderId, storyTitle, childFirstName, illustrationStyle } = params;

    try {
      const supabase = getSupabase();

      const prompt = this.buildFrontCoverPrompt(storyTitle, childFirstName, illustrationStyle);

      console.log('Generating front cover...');
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Flux Kontext
      const result: any = await fal.subscribe('fal-ai/flux-pro/kontext/text-to-image', {
        input: {
          prompt: prompt,
          image_size: 'square_hd',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
          output_format: 'png',
        },
        logs: false,
      });

      if (!result.images || result.images.length === 0) {
        throw new Error('No cover image generated from Flux');
      }

      // Download the generated image
      const generatedImageUrl = result.images[0].url;
      const imageResponse = await axios.get(generatedImageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);

      // Generate thumbnail
      const thumbnail = await sharp(imageBuffer)
        .resize(256, 256)
        .toBuffer();

      // Upload to Supabase Storage
      const imagePath = `${bookOrderId}/cover-front.png`;
      const thumbnailPath = `${bookOrderId}/cover-front-thumb.png`;

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

      // Save to database (page_number = 0 for front cover, story_page_id = null)
      const { data: generatedImage, error: dbError } = await supabase
        .from('generated_images')
        .insert({
          book_order_id: bookOrderId,
          story_page_id: null,
          page_number: 0,
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

      console.log('Front cover generated successfully');
      return generatedImage;
    } catch (error) {
      console.error('Error generating front cover:', error);
      throw error;
    }
  }

  async generateBackCover(params: {
    bookOrderId: string;
    storyTitle: string;
    childFirstName: string;
    storySummary: string;
    illustrationStyle: string;
  }): Promise<any> {
    const { bookOrderId, storyTitle, childFirstName, storySummary, illustrationStyle } = params;

    try {
      const supabase = getSupabase();

      const prompt = this.buildBackCoverPrompt(storyTitle, childFirstName, storySummary, illustrationStyle);

      console.log('Generating back cover...');
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Flux Kontext
      const result: any = await fal.subscribe('fal-ai/flux-pro/kontext/text-to-image', {
        input: {
          prompt: prompt,
          image_size: 'square_hd',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
          output_format: 'png',
        },
        logs: false,
      });

      if (!result.images || result.images.length === 0) {
        throw new Error('No back cover image generated from Flux');
      }

      // Download the generated image
      const generatedImageUrl = result.images[0].url;
      const imageResponse = await axios.get(generatedImageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);

      // Generate thumbnail
      const thumbnail = await sharp(imageBuffer)
        .resize(256, 256)
        .toBuffer();

      // Upload to Supabase Storage
      const imagePath = `${bookOrderId}/cover-back.png`;
      const thumbnailPath = `${bookOrderId}/cover-back-thumb.png`;

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

      // Save to database (page_number = 16 for back cover, story_page_id = null)
      const { data: generatedImage, error: dbError } = await supabase
        .from('generated_images')
        .insert({
          book_order_id: bookOrderId,
          story_page_id: null,
          page_number: 16,
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

      console.log('Back cover generated successfully');
      return generatedImage;
    } catch (error) {
      console.error('Error generating back cover:', error);
      throw error;
    }
  }

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

      // Generate image with Flux Kontext (designed for flawless typography)
      const result: any = await fal.subscribe('fal-ai/flux-pro/kontext/text-to-image', {
        input: {
          prompt: prompt,
          image_size: 'square_hd',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
          output_format: 'png',
        },
        logs: false,
      });

      if (!result.images || result.images.length === 0) {
        throw new Error('No image generated from Flux');
      }

      // Download the generated image
      const generatedImageUrl = result.images[0].url;
      const imageResponse = await axios.get(generatedImageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);

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
      'watercolour': 'soft watercolor painting style with gentle brushstrokes',
      'digital-art': 'vibrant digital illustration with smooth colors',
      'cartoon': 'playful cartoon style with bold outlines and bright colors',
      'storybook-classic': 'classic children storybook illustration, warm and timeless',
      'modern-minimal': 'clean modern illustration with simple shapes',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    // Flux Kontext is designed for flawless typography - include the text!
    let prompt = `A professional children's book page illustration. `;
    prompt += `Scene: ${storyPage.image_prompt}. `;
    prompt += `The illustration features ${childFirstName}, an 8-year-old child. `;
    prompt += `Style: ${styleGuide}. `;
    prompt += `The words "${storyPage.page_text}" are painted in the bottom third with perfect, legible typography. `;
    prompt += `The text uses a clean, child-friendly font with excellent readability. `;
    prompt += `Professional children's book quality. Bright, inviting colors. Safe, age-appropriate content.`;

    return prompt;
  }

  private buildFrontCoverPrompt(storyTitle: string, childFirstName: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'soft watercolor painting style with gentle brushstrokes',
      'digital-art': 'vibrant digital illustration with smooth colors',
      'cartoon': 'playful cartoon style with bold outlines and bright colors',
      'storybook-classic': 'classic children storybook illustration, warm and timeless',
      'modern-minimal': 'clean modern illustration with simple shapes',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    let prompt = `A beautiful children's book front cover design. `;
    prompt += `The title "${storyTitle}" is prominently displayed at the top with large, eye-catching typography. `;
    prompt += `Below the title, there's an enchanting illustration featuring ${childFirstName}, an 8-year-old child, in a magical, inviting scene that captures the essence of the story. `;
    prompt += `At the bottom, the text "Starring ${childFirstName}" is displayed in elegant lettering. `;
    prompt += `Style: ${styleGuide}. `;
    prompt += `Professional children's book cover quality with perfect, legible typography. `;
    prompt += `Vibrant, inviting colors that appeal to children. `;
    prompt += `Award-winning book cover design. Safe, age-appropriate content.`;

    return prompt;
  }

  private buildBackCoverPrompt(storyTitle: string, childFirstName: string, storySummary: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'soft watercolor painting style with gentle brushstrokes',
      'digital-art': 'vibrant digital illustration with smooth colors',
      'cartoon': 'playful cartoon style with bold outlines and bright colors',
      'storybook-classic': 'classic children storybook illustration, warm and timeless',
      'modern-minimal': 'clean modern illustration with simple shapes',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    let prompt = `A beautiful children's book back cover design. `;
    prompt += `At the top, a decorative header with small illustrations in ${styleGuide}. `;
    prompt += `The main text area contains: "${storySummary}". `;
    prompt += `This text is displayed with perfect, legible typography in a clean, child-friendly font. `;
    prompt += `At the bottom, smaller text reads "A personalized adventure created for ${childFirstName}". `;
    prompt += `The background features subtle, whimsical illustrations that complement the front cover. `;
    prompt += `Professional children's book back cover quality. `;
    prompt += `Warm, inviting colors. Excellent readability. Safe, age-appropriate design.`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
