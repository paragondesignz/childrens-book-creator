import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Lazy initialization to ensure environment variables are loaded
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Lazy initialization for Gemini to ensure environment variables are loaded
function getGemini() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Helper to convert URL to base64 for Gemini API
async function urlToBase64(url: string): Promise<{ inlineData: { data: string; mimeType: string } }> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const base64 = buffer.toString('base64');

    // Determine MIME type from response or URL
    let mimeType = response.headers['content-type'] || 'image/jpeg';
    if (url.toLowerCase().endsWith('.png')) mimeType = 'image/png';
    else if (url.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

    return {
      inlineData: {
        data: base64,
        mimeType: mimeType
      }
    };
  } catch (error) {
    console.error('Error converting URL to base64:', error);
    throw error;
  }
}

interface GenerateImagesParams {
  storyId: string;
  bookOrderId: string;
  pages: any[];
  illustrationStyle: string;
  childFirstName: string;
}

export class ImageGenerationService {
  // Cache reference photo per book order to avoid redundant DB queries
  private referencePhotoCache: Map<string, string | null> = new Map();

  /**
   * Fetches the child's reference photo URL from Supabase
   * Returns null if no photo is found
   * CACHED: Only fetches from DB once per book order
   */
  private async getChildReferencePhoto(bookOrderId: string): Promise<string | null> {
    // Check cache first
    if (this.referencePhotoCache.has(bookOrderId)) {
      console.log(`Using cached reference photo for book order ${bookOrderId}`);
      return this.referencePhotoCache.get(bookOrderId)!;
    }

    try {
      const supabase = getSupabase();

      // Query uploaded_images table for child photo
      const { data, error } = await supabase
        .from('uploaded_images')
        .select('storage_url')
        .eq('book_order_id', bookOrderId)
        .eq('image_type', 'child_photo')
        .single();

      const photoUrl = (error || !data) ? null : data.storage_url;

      // Cache the result
      this.referencePhotoCache.set(bookOrderId, photoUrl);

      if (photoUrl) {
        console.log(`Found and cached reference photo for book order ${bookOrderId}`);
      } else {
        console.warn(`No reference photo found for book order ${bookOrderId}`);
      }

      return photoUrl;
    } catch (error) {
      console.error('Error fetching reference photo:', error);
      this.referencePhotoCache.set(bookOrderId, null);
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

      console.log('Generating front cover with Gemini 2.0 Flash...');
      console.log(`Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Gemini
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Prepare input parts
      const parts: any[] = [];

      if (referenceImageUrl) {
        const referenceImageData = await urlToBase64(referenceImageUrl);
        parts.push(referenceImageData);
        parts.push({ text: `This is ${childFirstName}, the main character. Use this person's exact appearance.` });
      }

      parts.push({ text: prompt });

      const result = await model.generateContent(parts);
      const response = result.response;

      if (!response || !response.candidates || response.candidates.length === 0) {
        throw new Error('No cover image generated from Gemini');
      }

      // Extract image data from response
      const candidate = response.candidates[0];
      let imageBuffer: Buffer | null = null;

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            break;
          }
        }
      }

      if (!imageBuffer) {
        throw new Error('No image data found in Gemini response');
      }

      // Upload to Supabase Storage
      const imagePath = `${bookOrderId}/cover-front.png`;

      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(imagePath, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl: imageUrl } } = supabase.storage
        .from('generated-images')
        .getPublicUrl(imagePath);

      // Save to database (page_number = 0 for front cover, story_page_id = null)
      const { data: generatedImage, error: dbError } = await supabase
        .from('generated_images')
        .insert({
          book_order_id: bookOrderId,
          story_page_id: null,
          page_number: 0,
          image_url: imageUrl,
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

      console.log('Generating back cover with Gemini 2.0 Flash...');
      console.log(`Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Gemini
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Prepare input parts
      const parts: any[] = [];

      if (referenceImageUrl) {
        const referenceImageData = await urlToBase64(referenceImageUrl);
        parts.push(referenceImageData);
        parts.push({ text: `This is ${childFirstName}, the main character. Use this person's exact appearance.` });
      }

      parts.push({ text: prompt });

      const result = await model.generateContent(parts);
      const response = result.response;

      if (!response || !response.candidates || response.candidates.length === 0) {
        throw new Error('No back cover image generated from Gemini');
      }

      // Extract image data from response
      const candidate = response.candidates[0];
      let imageBuffer: Buffer | null = null;

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            break;
          }
        }
      }

      if (!imageBuffer) {
        throw new Error('No image data found in Gemini response');
      }

      // Upload to Supabase Storage
      const imagePath = `${bookOrderId}/cover-back.png`;

      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(imagePath, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl: imageUrl } } = supabase.storage
        .from('generated-images')
        .getPublicUrl(imagePath);

      // Save to database (page_number = 16 for back cover, story_page_id = null)
      const { data: generatedImage, error: dbError } = await supabase
        .from('generated_images')
        .insert({
          book_order_id: bookOrderId,
          story_page_id: null,
          page_number: 16,
          image_url: imageUrl,
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

      // Generate images in batches to avoid rate limits while maximizing parallelization
      // Increased batch size from 3 to 5 for better performance
      // Replicate typically allows higher concurrency, adjust if rate limit errors occur
      const batchSize = 5;
      for (let i = 0; i < storyPages.length; i += batchSize) {
        const batch = storyPages.slice(i, i + batchSize);
        const batchStartTime = Date.now();

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

        const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
        console.log(`Generated images ${i + 1}-${Math.min(i + batchSize, storyPages.length)} of ${storyPages.length} in ${batchDuration}s`);
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
    const pageStartTime = Date.now();

    try {
      const supabase = getSupabase();

      // Fetch child's reference photo (cached after first call)
      const photoFetchStart = Date.now();
      const referenceImageUrl = await this.getChildReferencePhoto(bookOrderId);
      const photoFetchTime = Date.now() - photoFetchStart;

      const prompt = this.buildImagePrompt(storyPage, illustrationStyle, childFirstName);

      console.log(`[Page ${storyPage.page_number}] Starting generation (photo fetch: ${photoFetchTime}ms)`);
      console.log(`[Page ${storyPage.page_number}] Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);

      // Generate image with Gemini 2.5 Flash Image
      const genStart = Date.now();
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Prepare input parts: reference image(s) + prompt
      const parts: any[] = [];

      if (referenceImageUrl) {
        // Convert reference image to base64
        const referenceImageData = await urlToBase64(referenceImageUrl);
        parts.push(referenceImageData);
        // Add instruction about the reference
        parts.push({ text: `This is ${childFirstName}, the main character. Use this person's exact appearance throughout.` });
      }

      // Add the main prompt
      parts.push({ text: prompt });

      const result = await model.generateContent(parts);
      const response = result.response;

      // Gemini returns image as base64 in response
      if (!response || !response.candidates || response.candidates.length === 0) {
        throw new Error('No image generated from Gemini');
      }

      const genTime = Date.now() - genStart;
      console.log(`[Page ${storyPage.page_number}] AI generation completed in ${Math.round(genTime / 1000)}s`);

      // Extract image data from response
      // Note: Gemini's image generation returns the image in the response
      const downloadStart = Date.now();
      const candidate = response.candidates[0];

      // Gemini returns base64 encoded image in parts
      let imageBuffer: Buffer | null = null;

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            break;
          }
        }
      }

      if (!imageBuffer) {
        throw new Error('No image data found in Gemini response');
      }

      const downloadTime = Date.now() - downloadStart;

      // Upload to Supabase Storage
      const uploadStart = Date.now();
      const imagePath = `${bookOrderId}/page-${storyPage.page_number}.png`;

      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(imagePath, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const uploadTime = Date.now() - uploadStart;

      // Get public URL
      const { data: { publicUrl: imageUrl } } = supabase.storage
        .from('generated-images')
        .getPublicUrl(imagePath);

      // Save to database
      const dbStart = Date.now();
      const { data: generatedImage, error: dbError } = await supabase
        .from('generated_images')
        .insert({
          book_order_id: bookOrderId,
          story_page_id: storyPage.id,
          page_number: storyPage.page_number,
          image_url: imageUrl,
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
      const dbTime = Date.now() - dbStart;

      const totalTime = Date.now() - pageStartTime;
      console.log(`[Page ${storyPage.page_number}] ✓ Complete in ${Math.round(totalTime / 1000)}s (AI: ${Math.round(genTime / 1000)}s, download: ${downloadTime}ms, upload: ${uploadTime}ms, db: ${dbTime}ms)`);

      return generatedImage;
    } catch (error) {
      console.error(`Error generating image for page ${storyPage.page_number}:`, error);
      throw error;
    }
  }

  private buildImagePrompt(storyPage: any, illustrationStyle: string, childFirstName: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'Soft watercolor painting with gentle, flowing brushstrokes and translucent layers. Dreamy, delicate colors that blend naturally.',
      'digital-art': 'Modern digital illustration with smooth gradients, vibrant colors, and polished finish. Contemporary and eye-catching.',
      'cartoon': 'Playful cartoon style with bold black outlines, exaggerated features, and bright saturated colors. Fun and energetic.',
      'storybook-classic': 'Traditional storybook illustration in the style of classic children\'s literature. Warm, timeless, and nostalgic with detailed linework.',
      'modern-minimal': 'Clean modern illustration with simple geometric shapes, limited color palette, and minimalist design. Contemporary and sophisticated.',
      'photographic': 'Photorealistic rendering with natural lighting, detailed textures, and lifelike appearance. Highly realistic and dimensional.',
      'anime': 'Japanese anime art style with large expressive eyes, dynamic poses, and cel-shaded coloring. Energetic and stylized.',
      'comic-book': 'Bold comic book style with dynamic action poses, vibrant primary colors, strong shadows, and dramatic composition. Superhero aesthetic.',
      'fantasy-realistic': 'Detailed fantasy illustration combining realistic rendering with magical elements. Rich colors, dramatic lighting, and intricate details.',
      'graphic-novel': 'Sophisticated graphic novel style with cinematic composition, dramatic lighting, and mature artistic sensibility. Moody and atmospheric.',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    // Build comprehensive prompt for Gemini
    let prompt = `Create a professional children's book illustration.\n\n`;
    prompt += `STYLE: ${styleGuide}\n\n`;
    prompt += `IMPORTANT CHARACTER CONSISTENCY:\n`;
    prompt += `- The main character is ${childFirstName}, shown in the reference image provided\n`;
    prompt += `- Keep the EXACT same face, hair color, hair style, eye color, and physical features from the reference\n`;
    prompt += `- Ensure ${childFirstName} is immediately recognizable as the same person\n`;
    prompt += `- Maintain consistent age appearance and proportions\n\n`;
    prompt += `SCENE: ${storyPage.image_prompt}\n\n`;
    prompt += `REQUIREMENTS:\n`;
    prompt += `- Full-page illustration with no text, words, or letters\n`;
    prompt += `- Bright, inviting, child-friendly colors\n`;
    prompt += `- Safe, age-appropriate content\n`;
    prompt += `- Professional storybook quality\n`;
    prompt += `- Clear focus on the main character ${childFirstName}\n`;
    prompt += `- Engaging composition that captures attention`;

    return prompt;
  }

  private buildFrontCoverPrompt(storyTitle: string, childFirstName: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'Soft watercolor painting with gentle, flowing brushstrokes',
      'digital-art': 'Modern digital illustration with smooth gradients and vibrant colors',
      'cartoon': 'Playful cartoon style with bold outlines and bright colors',
      'storybook-classic': 'Traditional storybook illustration, warm and timeless',
      'modern-minimal': 'Clean modern illustration with simple shapes',
      'photographic': 'Photorealistic rendering with natural lighting',
      'anime': 'Japanese anime art style with expressive features',
      'comic-book': 'Bold comic book style with dynamic composition',
      'fantasy-realistic': 'Detailed fantasy illustration with realistic rendering',
      'graphic-novel': 'Sophisticated graphic novel style with dramatic lighting',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    let prompt = `Create a stunning children's book front cover.\n\n`;
    prompt += `STYLE: ${styleGuide}\n\n`;
    prompt += `CHARACTER: ${childFirstName} from the reference image - use EXACT same appearance\n\n`;
    prompt += `COMPOSITION: Feature ${childFirstName} in an enchanting, magical scene that captures imagination\n\n`;
    prompt += `TEXT ELEMENTS:\n`;
    prompt += `- Top: "${storyTitle}" in large, bold, playful letters\n`;
    prompt += `- Bottom: "Starring ${childFirstName}" in elegant script\n\n`;
    prompt += `QUALITY: Professional, award-winning book cover design with vibrant, inviting colors`;

    return prompt;
  }

  private buildBackCoverPrompt(storyTitle: string, childFirstName: string, storySummary: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'Soft watercolor painting with gentle brushstrokes',
      'digital-art': 'Modern digital illustration with vibrant colors',
      'cartoon': 'Playful cartoon style with bold outlines',
      'storybook-classic': 'Traditional storybook illustration',
      'modern-minimal': 'Clean modern illustration',
      'photographic': 'Photorealistic rendering',
      'anime': 'Japanese anime art style',
      'comic-book': 'Bold comic book style',
      'fantasy-realistic': 'Detailed fantasy illustration',
      'graphic-novel': 'Sophisticated graphic novel style',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    let prompt = `Create a beautiful children's book back cover illustration.\n\n`;
    prompt += `STYLE: ${styleGuide}\n\n`;
    prompt += `CHARACTER: ${childFirstName} from the reference image - use EXACT same appearance\n\n`;
    prompt += `COMPOSITION: Decorative, whimsical scene in a magical, enchanting setting\n\n`;
    prompt += `REQUIREMENTS:\n`;
    prompt += `- No text or words\n`;
    prompt += `- Professional book cover quality\n`;
    prompt += `- Warm, inviting colors\n`;
    prompt += `- Safe, age-appropriate design`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
