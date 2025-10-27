import Replicate from 'replicate';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Lazy initialization to ensure environment variables are loaded
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Lazy initialization for Replicate to ensure environment variables are loaded
function getReplicate() {
  return new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
}

interface GenerateImagesParams {
  storyId: string;
  bookOrderId: string;
  pages: any[];
  illustrationStyle: string;
  childFirstName: string;
}

export class ImageGenerationService {

  /**
   * Fetches the child's reference photo URL from Supabase
   * Returns null if no photo is found
   */
  private async getChildReferencePhoto(bookOrderId: string): Promise<string | null> {
    try {
      const supabase = getSupabase();

      // Query uploaded_images table for child photo
      const { data, error } = await supabase
        .from('uploaded_images')
        .select('storage_url')
        .eq('book_order_id', bookOrderId)
        .eq('image_type', 'child_photo')
        .single();

      if (error || !data) {
        console.warn(`No reference photo found for book order ${bookOrderId}`);
        return null;
      }

      console.log(`Found reference photo for book order ${bookOrderId}`);
      return data.storage_url;
    } catch (error) {
      console.error('Error fetching reference photo:', error);
      return null;
    }
  }

  async generateFrontCover(params: {
    bookOrderId: string;
    storyTitle: string;
    childFirstName: string;
    illustrationStyle: string;
  }): Promise<any> {
    const { bookOrderId, storyTitle, childFirstName, illustrationStyle } = params;

    try {
      const supabase = getSupabase();

      // Fetch child's reference photo
      const referenceImageUrl = await this.getChildReferencePhoto(bookOrderId);

      const prompt = this.buildFrontCoverPrompt(storyTitle, childFirstName, illustrationStyle);

      console.log('Generating front cover with Seedream 4...');
      console.log(`Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Seedream 4
      const replicate = getReplicate();
      const output: any = await replicate.run(
        "bytedance/seedream-4",
        {
          input: {
            prompt: prompt,
            size: "2K",
            width: 2048,
            height: 2048,
            max_images: 1,
            image_input: referenceImageUrl ? [referenceImageUrl] : [],
            aspect_ratio: "1:1",
            enhance_prompt: false, // Keep our prompt as-is
            sequential_image_generation: "disabled"
          }
        }
      );

      if (!output || (Array.isArray(output) && output.length === 0)) {
        throw new Error('No cover image generated from Seedream 4');
      }

      // Download the generated image (Replicate returns array of URLs)
      const generatedImageUrl = Array.isArray(output) ? output[0] : output;
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
          width: 2048,
          height: 2048,
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

      // Fetch child's reference photo
      const referenceImageUrl = await this.getChildReferencePhoto(bookOrderId);

      const prompt = this.buildBackCoverPrompt(storyTitle, childFirstName, storySummary, illustrationStyle);

      console.log('Generating back cover with Seedream 4...');
      console.log(`Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Seedream 4
      const replicate = getReplicate();
      const output: any = await replicate.run(
        "bytedance/seedream-4",
        {
          input: {
            prompt: prompt,
            size: "2K",
            width: 2048,
            height: 2048,
            max_images: 1,
            image_input: referenceImageUrl ? [referenceImageUrl] : [],
            aspect_ratio: "1:1",
            enhance_prompt: false, // Keep our prompt as-is
            sequential_image_generation: "disabled"
          }
        }
      );

      if (!output || (Array.isArray(output) && output.length === 0)) {
        throw new Error('No back cover image generated from Seedream 4');
      }

      // Download the generated image (Replicate returns array of URLs)
      const generatedImageUrl = Array.isArray(output) ? output[0] : output;
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
          width: 2048,
          height: 2048,
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

      // Fetch child's reference photo
      const referenceImageUrl = await this.getChildReferencePhoto(bookOrderId);

      const prompt = this.buildImagePrompt(storyPage, illustrationStyle, childFirstName);

      console.log(`Generating image for page ${storyPage.page_number} with Seedream 4...`);
      console.log(`Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate image with Seedream 4
      const replicate = getReplicate();
      const output: any = await replicate.run(
        "bytedance/seedream-4",
        {
          input: {
            prompt: prompt,
            size: "2K",
            width: 2048,
            height: 2048,
            max_images: 1,
            image_input: referenceImageUrl ? [referenceImageUrl] : [],
            aspect_ratio: "1:1",
            enhance_prompt: false, // Keep our prompt as-is
            sequential_image_generation: "disabled"
          }
        }
      );

      if (!output || (Array.isArray(output) && output.length === 0)) {
        throw new Error('No image generated from Seedream 4');
      }

      // Download the generated image (Replicate returns array of URLs)
      const generatedImageUrl = Array.isArray(output) ? output[0] : output;
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
          width: 2048,
          height: 2048,
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
      'photographic': 'photorealistic style with natural lighting and detailed textures',
      'anime': 'Japanese anime style with expressive features and dynamic composition',
      'comic-book': 'bold comic book style with dynamic action and vibrant colors',
      'fantasy-realistic': 'detailed fantasy illustration with realistic rendering',
      'graphic-novel': 'sophisticated graphic novel style with dramatic lighting and mature composition',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    // Image only - text will be on opposite page programmatically
    // Reference image ensures character consistency
    let prompt = `A professional children's book page illustration in ${styleGuide}. `;
    prompt += `The main character is the child shown in the reference image, ${childFirstName}. `;
    prompt += `IMPORTANT: Use the EXACT same child from the reference photo - same face, hair, features. `;
    prompt += `Scene: ${storyPage.image_prompt}. `;
    prompt += `Full-page illustration with no text or words. `;
    prompt += `Bright, inviting colors. Safe, age-appropriate content. Professional storybook quality.`;

    return prompt;
  }

  private buildFrontCoverPrompt(storyTitle: string, childFirstName: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'soft watercolor painting style with gentle brushstrokes',
      'digital-art': 'vibrant digital illustration with smooth colors',
      'cartoon': 'playful cartoon style with bold outlines and bright colors',
      'storybook-classic': 'classic children storybook illustration, warm and timeless',
      'modern-minimal': 'clean modern illustration with simple shapes',
      'photographic': 'photorealistic style with natural lighting and detailed textures',
      'anime': 'Japanese anime style with expressive features and dynamic composition',
      'comic-book': 'bold comic book style with dynamic action and vibrant colors',
      'fantasy-realistic': 'detailed fantasy illustration with realistic rendering',
      'graphic-novel': 'sophisticated graphic novel style with dramatic lighting and mature composition',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    // Natural language format with contextual text placement
    let prompt = `A beautiful children's book front cover in ${styleGuide}. `;
    prompt += `The main character is the child shown in the reference image, ${childFirstName}. `;
    prompt += `IMPORTANT: Use the EXACT same child from the reference photo - same face, hair, features. `;
    prompt += `An enchanting illustration in a magical scene. `;
    prompt += `At the top of the cover is the title text that reads: "${storyTitle}" in large, bold, playful letters. `;
    prompt += `At the bottom is text that reads: "Starring ${childFirstName}" in elegant script. `;
    prompt += `Professional children's book cover quality. Vibrant, inviting colors. Award-winning design. Safe content.`;

    return prompt;
  }

  private buildBackCoverPrompt(storyTitle: string, childFirstName: string, storySummary: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'soft watercolor painting style with gentle brushstrokes',
      'digital-art': 'vibrant digital illustration with smooth colors',
      'cartoon': 'playful cartoon style with bold outlines and bright colors',
      'storybook-classic': 'classic children storybook illustration, warm and timeless',
      'modern-minimal': 'clean modern illustration with simple shapes',
      'photographic': 'photorealistic style with natural lighting and detailed textures',
      'anime': 'Japanese anime style with expressive features and dynamic composition',
      'comic-book': 'bold comic book style with dynamic action and vibrant colors',
      'fantasy-realistic': 'detailed fantasy illustration with realistic rendering',
      'graphic-novel': 'sophisticated graphic novel style with dramatic lighting and mature composition',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    // Back cover illustration only - text will be added programmatically
    let prompt = `A beautiful children's book back cover illustration in ${styleGuide}. `;
    prompt += `The main character is the child shown in the reference image, ${childFirstName}. `;
    prompt += `IMPORTANT: Use the EXACT same child from the reference photo - same face, hair, features. `;
    prompt += `Decorative whimsical illustration in a magical, enchanting scene. No text or words. `;
    prompt += `Professional book cover quality. Warm, inviting colors. Safe, age-appropriate design.`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
