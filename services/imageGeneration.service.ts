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

      console.log('Generating front cover with Gemini 2.5 Flash Image...');
      console.log(`Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Gemini
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        // Note: responseModalities defaults to ['Text', 'Image'] for this model
      });

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

      console.log('Generating back cover with Gemini 2.5 Flash Image...');
      console.log(`Reference photo: ${referenceImageUrl ? 'Yes' : 'No'}`);
      console.log(`Prompt: ${prompt.substring(0, 200)}...`);

      // Generate cover with Gemini
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        // Note: responseModalities defaults to ['Text', 'Image'] for this model
      });

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

  async generateImagesForStory(params: GenerateImagesParams & {
    storyTitle: string;
    generateCovers?: boolean;
  }): Promise<any[]> {
    const { storyId, bookOrderId, pages, illustrationStyle, childFirstName, storyTitle, generateCovers = false } = params;

    try {
      const supabase = getSupabase();
      console.log(`Generating ${generateCovers ? 'covers + ' : ''}${pages.length} pages using conversation-based approach for consistency...`);

      // Fetch story pages from database to get IDs
      const { data: storyPages, error } = await supabase
        .from('story_pages')
        .select('*')
        .eq('story_id', storyId)
        .order('page_number', { ascending: true });

      if (error || !storyPages) {
        throw new Error('Failed to fetch story pages');
      }

      // Fetch reference photo ONCE for the entire session
      const referenceImageUrl = await this.getChildReferencePhoto(bookOrderId);
      let referenceImageData = null;

      if (referenceImageUrl) {
        referenceImageData = await urlToBase64(referenceImageUrl);
        console.log(`Using reference photo for character consistency across all ${storyPages.length} pages`);
      }

      // START A CHAT SESSION FOR CONSISTENCY
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: {
          temperature: 0.7, // Balanced: 0.7 gives variety in poses/angles while maintaining character consistency
          // Note: responseModalities defaults to ['Text', 'Image'] for this model
          // 0.4 = very consistent but repetitive poses
          // 0.7 = varied compositions while keeping character features
          // 0.9+ = too much variation, character drift
        },
      });

      // Initialize chat for multi-turn image generation
      const chat = model.startChat({
        history: [],
      });

      // NOTE: We don't send an initial character context message because:
      // 1. Gemini 2.5 Flash Image requires every message to be an image generation request
      // 2. We include the reference photo with EVERY image anyway for consistency
      // 3. An initial "please confirm" message would cause a 400 error
      console.log(`Starting conversation-based generation with reference photo included in each request`);

      const generatedImages = [];

      // Generate front cover in conversation (if requested)
      if (generateCovers) {
        console.log('\n[Front Cover] Generating in conversation context...');
        try {
          const frontCoverImage = await this.generateCoverInConversation({
            chat,
            bookOrderId,
            storyTitle,
            childFirstName,
            illustrationStyle,
            referenceImageData,
            isBackCover: false,
          });
          generatedImages.push(frontCoverImage);
          console.log('[Front Cover] ✓ Generated successfully');
        } catch (error) {
          console.error('[Front Cover] Failed:', error);
          throw error;
        }
      }

      // Generate page images SEQUENTIALLY in the same conversation for consistency
      for (let i = 0; i < storyPages.length; i++) {
        const page = storyPages[i];
        console.log(`\n[Page ${page.page_number}] Generating in conversation context (${i + 1}/${storyPages.length})...`);

        try {
          const generatedImage = await this.generateImageInConversation({
            chat,
            bookOrderId,
            storyPage: page,
            illustrationStyle,
            childFirstName,
            referenceImageData,
            pageIndex: i,
            totalPages: storyPages.length,
          });

          generatedImages.push(generatedImage);
          console.log(`[Page ${page.page_number}] ✓ Generated successfully (${i + 1}/${storyPages.length} complete)`);
        } catch (pageError) {
          console.error(`[Page ${page.page_number}] Failed:`, pageError);
          throw pageError;
        }
      }

      // Generate back cover in conversation (if requested)
      if (generateCovers) {
        console.log('\n[Back Cover] Generating in conversation context...');
        try {
          const backCoverImage = await this.generateCoverInConversation({
            chat,
            bookOrderId,
            storyTitle,
            childFirstName,
            illustrationStyle,
            referenceImageData,
            isBackCover: true,
          });
          generatedImages.push(backCoverImage);
          console.log('[Back Cover] ✓ Generated successfully');
        } catch (error) {
          console.error('[Back Cover] Failed:', error);
          throw error;
        }
      }

      console.log(`\n✓ All ${generatedImages.length} images generated successfully with conversation-based consistency`);
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
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        // Note: responseModalities defaults to ['Text', 'Image'] for this model
      });

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
      'photographic': 'Photorealistic photograph with natural lighting, detailed textures, and lifelike appearance. Shot with professional camera, realistic depth of field, authentic photography, NOT illustrated or drawn. Real-world photography aesthetic with natural colors and lighting.',
      'anime': 'Japanese anime art style with large expressive eyes, dynamic poses, and cel-shaded coloring. Energetic and stylized.',
      'comic-book': 'Bold comic book style with dynamic action poses, vibrant primary colors, strong shadows, and dramatic composition. Superhero aesthetic.',
      'fantasy-realistic': 'Detailed fantasy illustration combining realistic rendering with magical elements. Rich colors, dramatic lighting, and intricate details.',
      'graphic-novel': 'Sophisticated graphic novel style with cinematic composition, dramatic lighting, and mature artistic sensibility. Moody and atmospheric.',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];

    // Adaptive opening based on style - photographic needs completely different language
    const isPhotographic = illustrationStyle === 'photographic';
    let prompt = isPhotographic
      ? `Create a professional photograph of a real scene.\n\n`
      : `Create a professional children's book illustration.\n\n`;

    prompt += `VISUAL STYLE: ${styleGuide}\n\n`;

    if (isPhotographic) {
      prompt += `CRITICAL - PHOTOREALISTIC REQUIREMENTS:\n`;
      prompt += `- This must be an ACTUAL PHOTOGRAPH of a real scene, not drawn, painted, illustrated, or digitally illustrated\n`;
      prompt += `- Shot with a professional camera - Canon, Nikon, Sony style photography\n`;
      prompt += `- Natural camera angles, realistic depth of field, real bokeh effect\n`;
      prompt += `- Natural lighting - outdoor daylight or indoor ambient lighting as if photographed in real life\n`;
      prompt += `- Real-world textures, materials, and physical environments - no cartoon, illustration, or art style\n`;
      prompt += `- Photojournalistic aesthetic - authentic, unedited, documentary-style photography\n`;
      prompt += `- Absolutely NO illustrated, drawn, painted, or artistic interpretation\n\n`;
    }

    prompt += `IMPORTANT CHARACTER CONSISTENCY:\n`;
    prompt += `- The main character is ${childFirstName}, shown in the reference image provided\n`;
    prompt += `- Keep the EXACT same face, hair color, hair style, eye color, and physical features from the reference\n`;
    prompt += `- Ensure ${childFirstName} is immediately recognizable as the same person\n`;
    prompt += `- Maintain consistent age appearance and proportions\n\n`;
    prompt += `SCENE: ${storyPage.image_prompt}\n\n`;
    prompt += `COMPOSITION REQUIREMENTS:\n`;
    prompt += `- ${isPhotographic ? 'Full-frame photograph' : 'Full-page illustration'} focusing entirely on the visual scene\n`;
    prompt += `- Bright, inviting, ${isPhotographic ? 'natural' : 'child-friendly'} colors ${isPhotographic ? 'from natural lighting' : 'that spark joy'}\n`;
    prompt += `- Safe, warm, age-appropriate content ${isPhotographic ? 'suitable for children' : 'perfect for young readers'}\n`;
    prompt += `- Professional ${isPhotographic ? 'photography - magazine or editorial quality' : 'storybook quality'} with rich details and textures\n`;
    prompt += `- ${childFirstName} as the clear focal point of the ${isPhotographic ? 'frame' : 'composition'}\n`;
    prompt += `- ${isPhotographic ? 'Candid, natural moment capturing authentic emotion' : 'Engaging, dynamic composition that captures attention and imagination'}`;

    return prompt;
  }

  private buildFrontCoverPrompt(storyTitle: string, childFirstName: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'Soft watercolor painting with gentle, flowing brushstrokes',
      'digital-art': 'Modern digital illustration with smooth gradients and vibrant colors',
      'cartoon': 'Playful cartoon style with bold outlines and bright colors',
      'storybook-classic': 'Traditional storybook illustration, warm and timeless',
      'modern-minimal': 'Clean modern illustration with simple shapes',
      'photographic': 'Photorealistic photograph with natural lighting and real-world photography aesthetic, NOT illustrated or drawn',
      'anime': 'Japanese anime art style with expressive features',
      'comic-book': 'Bold comic book style with dynamic composition',
      'fantasy-realistic': 'Detailed fantasy illustration with realistic rendering',
      'graphic-novel': 'Sophisticated graphic novel style with dramatic lighting',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];
    const isPhotographic = illustrationStyle === 'photographic';

    let prompt = isPhotographic
      ? `Create a professional photograph for a cover featuring real people in a real environment.\n\n`
      : `Create a stunning children's book front cover illustration.\n\n`;

    prompt += `TEXT TO RENDER:\n`;
    prompt += `- At the top of the cover, render the title text "${storyTitle}" in large, bold, playful serif font suitable for children's books\n`;
    prompt += `- At the bottom of the cover, render the subtitle "Starring ${childFirstName}" in an elegant, flowing script font\n`;
    prompt += `- Ensure all text is perfectly legible, well-spaced, and professionally typeset\n\n`;

    if (isPhotographic) {
      prompt += `VISUAL STYLE: Photorealistic photography - professional editorial or lifestyle photography aesthetic\n\n`;
      prompt += `CRITICAL - PHOTOREALISTIC REQUIREMENTS:\n`;
      prompt += `- This must be a REAL PHOTOGRAPH shot with a professional camera, NOT an illustration, drawing, or digital art\n`;
      prompt += `- Professional camera work - shallow depth of field, natural bokeh, realistic exposure\n`;
      prompt += `- Natural outdoor or studio lighting - golden hour, soft window light, or professional photo lighting\n`;
      prompt += `- Real physical environment - actual location, not painted or illustrated backdrop\n`;
      prompt += `- Documentary/lifestyle photography style - capturing real moments\n\n`;
    } else {
      prompt += `VISUAL STYLE: ${styleGuide} with vibrant, inviting colors and professional book cover aesthetic\n\n`;
    }

    prompt += `MAIN CHARACTER: ${childFirstName} from the reference image provided - maintain EXACT same facial features, hair, and appearance\n\n`;
    prompt += `SCENE COMPOSITION: Feature ${childFirstName} as the hero in an ${isPhotographic ? 'outdoor adventure or magical real-world location' : 'enchanting, magical scene'} that sparks imagination. The character should be prominently displayed in the center-lower portion of the ${isPhotographic ? 'frame' : 'cover'}, with the scene creating a sense of wonder and adventure. Rich details, ${isPhotographic ? 'natural photographic' : 'dynamic'} lighting, and a composition that draws the eye to both the character and the title text.`;

    return prompt;
  }

  private buildBackCoverPrompt(storyTitle: string, childFirstName: string, storySummary: string, illustrationStyle: string): string {
    const styleGuides: Record<string, string> = {
      'watercolour': 'Soft watercolor painting with gentle brushstrokes',
      'digital-art': 'Modern digital illustration with vibrant colors',
      'cartoon': 'Playful cartoon style with bold outlines',
      'storybook-classic': 'Traditional storybook illustration',
      'modern-minimal': 'Clean modern illustration',
      'photographic': 'Photorealistic photograph with natural lighting, NOT illustrated or drawn',
      'anime': 'Japanese anime art style',
      'comic-book': 'Bold comic book style',
      'fantasy-realistic': 'Detailed fantasy illustration',
      'graphic-novel': 'Sophisticated graphic novel style',
    };

    const styleGuide = styleGuides[illustrationStyle] || styleGuides['watercolour'];
    const isPhotographic = illustrationStyle === 'photographic';

    let prompt = isPhotographic
      ? `Create a professional photograph for a back cover featuring a real person in a real environment.\n\n`
      : `Create a beautiful children's book back cover illustration.\n\n`;

    if (isPhotographic) {
      prompt += `VISUAL STYLE: Photorealistic editorial photography with warm, natural lighting\n\n`;
      prompt += `CRITICAL - PHOTOREALISTIC REQUIREMENTS:\n`;
      prompt += `- This must be a REAL PHOTOGRAPH taken with a professional camera, NOT illustrated, drawn, or painted\n`;
      prompt += `- Professional photography with natural camera angles and authentic depth of field\n`;
      prompt += `- Real outdoor or indoor environment with natural lighting\n`;
      prompt += `- Documentary or lifestyle photography aesthetic\n\n`;
    } else {
      prompt += `VISUAL STYLE: ${styleGuide} with warm, inviting colors and professional book cover aesthetic\n\n`;
    }

    prompt += `MAIN CHARACTER: ${childFirstName} from the reference image provided - maintain EXACT same facial features, hair, and appearance\n\n`;
    prompt += `SCENE COMPOSITION: A ${isPhotographic ? 'candid moment in a real' : 'decorative, whimsical scene in a magical, enchanting'} setting that complements the story's theme. ${isPhotographic ? 'Natural photograph' : 'Pure visual illustration'} showcasing ${childFirstName} in a memorable, heartwarming moment. The scene should feel safe, joyful, and age-appropriate, with rich ${isPhotographic ? 'photographic detail from real textures and lighting' : 'artistic details'} and a composition that creates emotional connection and wonder.`;

    return prompt;
  }

  /**
   * Builds initial character context prompt for establishing consistency
   */
  private buildCharacterContextPrompt(childFirstName: string, illustrationStyle: string): string {
    const styleDescriptions: Record<string, string> = {
      'photographic': 'photorealistic photographs that look like professional photography',
      'watercolour': 'soft watercolor paintings',
      'digital-art': 'modern digital illustrations',
      'cartoon': 'playful cartoon-style illustrations',
      'storybook-classic': 'traditional storybook illustrations',
      'modern-minimal': 'clean, minimalist modern illustrations',
      'anime': 'Japanese anime-style art',
      'comic-book': 'bold comic book-style illustrations',
      'fantasy-realistic': 'detailed fantasy illustrations',
      'graphic-novel': 'sophisticated graphic novel-style art',
    };

    const styleDesc = styleDescriptions[illustrationStyle] || 'illustrations';
    const isPhotographic = illustrationStyle === 'photographic';

    let prompt = `I need you to help me create a children's book with consistent ${styleDesc}.\n\n`;

    prompt += `CRITICAL CHARACTER REFERENCE:\n`;
    prompt += `This is ${childFirstName}, the main character of our story. Study this person's appearance VERY carefully:\n`;
    prompt += `- Exact facial features (face shape, nose, mouth, chin)\n`;
    prompt += `- Precise hair color, hair style, and hair texture\n`;
    prompt += `- Specific eye color and eye shape\n`;
    prompt += `- Skin tone and complexion\n`;
    prompt += `- Age appearance and body proportions\n`;
    prompt += `- Any distinctive features or characteristics\n\n`;

    prompt += `ILLUSTRATION STYLE REQUIREMENTS:\n`;
    prompt += `- Every image must be in the same ${styleDesc} style\n`;
    prompt += `- Consistent artistic approach across all pages\n`;
    prompt += `- Coherent visual aesthetic throughout the book\n\n`;

    prompt += `CONSISTENCY RULES:\n`;
    prompt += `- ${childFirstName} MUST look EXACTLY the same in every image\n`;
    prompt += `- Keep the SAME face, hair, eyes, and physical features in all images\n`;
    prompt += `- ${childFirstName} should be immediately recognizable as the same person\n`;
    prompt += `- Maintain the exact same artistic style for all pages\n`;
    prompt += `- Only the scene/setting/action should change - NOT ${childFirstName}'s appearance or the art style\n\n`;

    prompt += `Please confirm you understand by acknowledging the character's key features and the illustration style we'll use.`;

    return prompt;
  }

  /**
   * Generates a single image within an ongoing conversation for consistency
   */
  private async generateImageInConversation(params: {
    chat: any;
    bookOrderId: string;
    storyPage: any;
    illustrationStyle: string;
    childFirstName: string;
    referenceImageData: any;
    pageIndex: number;
    totalPages: number;
  }): Promise<any> {
    const { chat, bookOrderId, storyPage, illustrationStyle, childFirstName, referenceImageData, pageIndex } = params;
    const pageStartTime = Date.now();

    try {
      const supabase = getSupabase();

      // Build the prompt for this specific page
      const prompt = this.buildConversationalImagePrompt(storyPage, illustrationStyle, childFirstName, pageIndex);

      console.log(`[Page ${storyPage.page_number}] Sending prompt in conversation context...`);

      // Send message in conversation - include reference in EVERY image for maximum consistency
      // Gemini docs note that character features can drift, so we reinforce every time
      const messageParts: any[] = [];

      // ALWAYS include reference image for strongest character consistency
      if (referenceImageData) {
        messageParts.push(referenceImageData);
        console.log(`[Page ${storyPage.page_number}] Including reference image for consistency`);
      }

      messageParts.push({ text: prompt });

      const genStart = Date.now();
      const result = await chat.sendMessage(messageParts);
      const response = result.response;
      const genTime = Date.now() - genStart;

      if (!response || !response.candidates || response.candidates.length === 0) {
        throw new Error('No image generated from Gemini in conversation');
      }

      console.log(`[Page ${storyPage.page_number}] AI generation completed in ${Math.round(genTime / 1000)}s`);

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
      console.log(`[Page ${storyPage.page_number}] ✓ Complete in ${Math.round(totalTime / 1000)}s (AI: ${Math.round(genTime / 1000)}s, upload: ${uploadTime}ms, db: ${dbTime}ms)`);

      return generatedImage;
    } catch (error) {
      console.error(`Error generating image for page ${storyPage.page_number} in conversation:`, error);
      throw error;
    }
  }

  /**
   * Generates a cover within an ongoing conversation for consistency
   */
  private async generateCoverInConversation(params: {
    chat: any;
    bookOrderId: string;
    storyTitle: string;
    childFirstName: string;
    illustrationStyle: string;
    referenceImageData: any;
    isBackCover: boolean;
  }): Promise<any> {
    const { chat, bookOrderId, storyTitle, childFirstName, illustrationStyle, referenceImageData, isBackCover } = params;
    const coverType = isBackCover ? 'back' : 'front';
    const pageNumber = isBackCover ? 16 : 0;
    const coverStartTime = Date.now();

    try {
      const supabase = getSupabase();

      // Build the cover prompt
      const prompt = isBackCover
        ? this.buildConversationalBackCoverPrompt(storyTitle, childFirstName, illustrationStyle)
        : this.buildConversationalFrontCoverPrompt(storyTitle, childFirstName, illustrationStyle);

      console.log(`[${coverType.toUpperCase()} Cover] Sending prompt in conversation context...`);
      console.log(`[${coverType.toUpperCase()} Cover] Prompt length: ${prompt.length} chars`);
      console.log(`[${coverType.toUpperCase()} Cover] Prompt preview:`, prompt.substring(0, 300) + '...');

      // Send message in conversation with reference reinforcement
      const messageParts: any[] = [];

      // Always include reference for covers for stronger consistency
      if (referenceImageData) {
        messageParts.push(referenceImageData);
        console.log(`[${coverType.toUpperCase()} Cover] Including reference image`);
      }

      messageParts.push({ text: prompt });

      const genStart = Date.now();
      const result = await chat.sendMessage(messageParts);
      const response = result.response;
      const genTime = Date.now() - genStart;

      // DIAGNOSTIC LOGGING: Capture Gemini response details
      console.log(`[${coverType.toUpperCase()} Cover] Gemini response received in ${Math.round(genTime / 1000)}s`);
      console.log(`[${coverType.toUpperCase()} Cover] Response exists:`, !!response);
      console.log(`[${coverType.toUpperCase()} Cover] Candidates exist:`, !!response?.candidates);
      console.log(`[${coverType.toUpperCase()} Cover] Candidates count:`, response?.candidates?.length || 0);

      // Log prompt feedback (safety filters)
      if (response?.promptFeedback) {
        console.log(`[${coverType.toUpperCase()} Cover] Prompt Feedback:`, JSON.stringify(response.promptFeedback, null, 2));
      }

      // Log candidate details if they exist
      if (response?.candidates && response.candidates.length > 0) {
        response.candidates.forEach((candidate: any, idx: number) => {
          console.log(`[${coverType.toUpperCase()} Cover] Candidate ${idx}:`, {
            finishReason: candidate.finishReason,
            safetyRatings: candidate.safetyRatings,
            hasContent: !!candidate.content,
            partsCount: candidate.content?.parts?.length || 0
          });
        });
      }

      if (!response || !response.candidates || response.candidates.length === 0) {
        // Log full response structure for debugging
        console.error(`[${coverType.toUpperCase()} Cover] FULL RESPONSE OBJECT:`, JSON.stringify(response, null, 2));
        throw new Error(`No ${coverType} cover image generated from Gemini in conversation`);
      }

      console.log(`[${coverType.toUpperCase()} Cover] AI generation completed in ${Math.round(genTime / 1000)}s`);

      // Extract image data from response
      const candidate = response.candidates[0];
      let imageBuffer: Buffer | null = null;

      if (candidate.content && candidate.content.parts) {
        console.log(`[${coverType.toUpperCase()} Cover] Processing ${candidate.content.parts.length} parts from response`);
        for (const part of candidate.content.parts as any[]) {
          console.log(`[${coverType.toUpperCase()} Cover] Part type:`, {
            hasInlineData: !!part.inlineData,
            hasText: !!part.text,
            hasFileData: !!part.fileData
          });
          if (part.inlineData && part.inlineData.data) {
            imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            console.log(`[${coverType.toUpperCase()} Cover] Image buffer extracted: ${imageBuffer.length} bytes`);
            break;
          }
        }
      }

      if (!imageBuffer) {
        console.error(`[${coverType.toUpperCase()} Cover] No image buffer found. Candidate structure:`, JSON.stringify({
          hasContent: !!candidate.content,
          hasParts: !!candidate.content?.parts,
          partsCount: candidate.content?.parts?.length || 0,
          parts: candidate.content?.parts?.map((p: any) => ({
            hasInlineData: !!p.inlineData,
            hasText: !!p.text,
            hasFileData: !!p.fileData,
            textPreview: p.text?.substring(0, 100)
          }))
        }, null, 2));
        throw new Error(`No image data found in Gemini response for ${coverType} cover`);
      }

      // Upload to Supabase Storage
      const uploadStart = Date.now();
      const imagePath = `${bookOrderId}/cover-${coverType}.png`;

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
          story_page_id: null,
          page_number: pageNumber,
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

      const totalTime = Date.now() - coverStartTime;
      console.log(`[${coverType.toUpperCase()} Cover] ✓ Complete in ${Math.round(totalTime / 1000)}s (AI: ${Math.round(genTime / 1000)}s, upload: ${uploadTime}ms, db: ${dbTime}ms)`);

      return generatedImage;
    } catch (error) {
      console.error(`Error generating ${coverType} cover in conversation:`, error);
      throw error;
    }
  }

  /**
   * Builds a conversational front cover prompt
   */
  private buildConversationalFrontCoverPrompt(storyTitle: string, childFirstName: string, illustrationStyle: string): string {
    let prompt = `Now create the front cover for our story.\n\n`;

    prompt += `FRONT COVER REQUIREMENTS:\n`;
    prompt += `TITLE: "${storyTitle}"\n`;
    prompt += `SUBTITLE: "Starring ${childFirstName}"\n\n`;

    prompt += `CRITICAL REQUIREMENTS:\n`;
    prompt += `1. CHARACTER MATCH:\n`;
    prompt += `   - ${childFirstName} must look EXACTLY like the reference photo I just provided\n`;
    prompt += `   - Same face, hair color, hairstyle, eye color, and features\n`;
    prompt += `   - ${childFirstName} must be immediately recognizable\n\n`;

    prompt += `2. ILLUSTRATION STYLE (CRITICAL - MAINTAIN EXACT STYLE):\n`;
    prompt += this.getDetailedStyleInstructions(illustrationStyle);
    prompt += `\n`;

    prompt += `3. TEXT AND COMPOSITION:\n`;
    prompt += `   - Render title "${storyTitle}" at top in large, bold, playful font\n`;
    prompt += `   - Render "Starring ${childFirstName}" at bottom in elegant script\n`;
    prompt += `   - ${childFirstName} as the hero in an enchanting scene\n\n`;

    prompt += `Create the cover now. Remember: ${childFirstName} must match the reference photo exactly, and this must be a professional illustration.`;

    return prompt;
  }

  /**
   * Builds a conversational back cover prompt
   */
  private buildConversationalBackCoverPrompt(storyTitle: string, childFirstName: string, illustrationStyle: string): string {
    let prompt = `Now create the back cover for our story.\n\n`;

    prompt += `BACK COVER REQUIREMENTS:\n`;
    prompt += `- Decorative scene showing ${childFirstName} in a memorable moment\n`;
    prompt += `- Heartwarming and age-appropriate\n`;
    prompt += `- Complements the story's theme\n\n`;

    prompt += `CRITICAL REQUIREMENTS:\n`;
    prompt += `1. CHARACTER MATCH:\n`;
    prompt += `   - ${childFirstName} must look EXACTLY like the reference photo\n`;
    prompt += `   - Same facial features, hair, eyes as in ALL previous images\n`;
    prompt += `   - Perfect consistency with front cover and story pages\n\n`;

    prompt += `2. ILLUSTRATION STYLE (CRITICAL - MAINTAIN EXACT STYLE):\n`;
    prompt += this.getDetailedStyleInstructions(illustrationStyle);
    prompt += `\n`;

    prompt += `Create the back cover now. Remember: ${childFirstName} must be identical to all previous images, and this must be a professional illustration.`;

    return prompt;
  }

  /**
   * Builds a conversational image prompt that maintains context
   */
  private getDetailedStyleInstructions(illustrationStyle: string): string {
    const styleInstructions: Record<string, string> = {
      'watercolour': `   - WATERCOLOUR PAINTING style - soft, flowing brushstrokes with visible paper texture
   - Use translucent, layered washes of color that blend into each other naturally
   - Show watercolor bleeding and feathering effects at edges
   - Soft, diffused edges (NOT hard lines or digital-looking)
   - Gentle gradients from light to dark within each color area
   - White paper showing through in lighter areas for luminosity
   - Organic, hand-painted feel with slight color variations
   - Dreamy, delicate aesthetic like children's picture books from the 1980s-90s
   - Think Beatrix Potter, Jill Barklem, or modern watercolor illustrators
   - AVOID: Digital-looking gradients, perfect smooth colors, hard edges`,

      'digital-art': `   - MODERN DIGITAL ILLUSTRATION - smooth, polished, contemporary style
   - Clean vector-like shapes with smooth gradients and soft shadows
   - Vibrant, saturated colors with professional color harmony
   - Subtle texture overlays for depth (canvas texture, grain, or noise)
   - Crisp, controlled edges with occasional soft focus for depth
   - Dimensional lighting with highlights, midtones, and shadows
   - Stylized but detailed rendering - not flat or overly simple
   - Contemporary children's book aesthetic (think Pete the Cat, modern picture books)
   - Professional finish like Procreate or Adobe Illustrator artwork
   - AVOID: Rough sketchy lines, watercolor bleeding, overly realistic rendering`,

      'cartoon': `   - CLASSIC CARTOON STYLE - bold, playful, energetic aesthetic
   - THICK black ink outlines around all shapes and characters (2-3px weight)
   - Exaggerated features: large expressive eyes, simplified shapes, bouncy proportions
   - Bright, saturated primary and secondary colors
   - Flat color fills with minimal shading (cel-shaded look)
   - Simple backgrounds with bold shapes and patterns
   - Dynamic, expressive poses with motion lines when appropriate
   - Fun, whimsical details and playful compositions
   - Think classic animation style (Disney, Warner Bros, modern cartoons)
   - AVOID: Realistic rendering, subtle colors, photo-realistic details`,

      'storybook-classic': `   - TRADITIONAL STORYBOOK ILLUSTRATION - warm, timeless, nostalgic
   - Detailed pen-and-ink linework with crosshatching and fine details
   - Warm, muted color palette (earth tones, soft pastels, gentle colors)
   - Hand-drawn quality with visible pencil or ink lines
   - Rich textures: fabric weaves, wood grain, foliage details
   - Classical composition with carefully balanced elements
   - Vintage children's book aesthetic (1950s-1970s golden age)
   - Detailed backgrounds with depth and atmosphere
   - Think Maurice Sendak, E.H. Shepard, or Garth Williams
   - AVOID: Bright neon colors, modern digital effects, minimalism`,

      'modern-minimal': `   - MODERN MINIMALIST ILLUSTRATION - clean, simple, sophisticated
   - SIMPLE GEOMETRIC SHAPES - circles, rectangles, triangles as building blocks
   - LIMITED COLOR PALETTE - 3-5 carefully chosen colors maximum
   - Flat colors with NO gradients or shading (pure flat design)
   - Generous negative space (white space) around elements
   - Clean lines and shapes with perfect edges
   - Abstract, simplified representations rather than detailed realism
   - Scandinavian design aesthetic - calm, uncluttered, purposeful
   - Contemporary minimalist children's books (think Jon Klassen, Oliver Jeffers)
   - AVOID: Busy details, many colors, realistic textures, decorative elements`,

      'anime': `   - JAPANESE ANIME STYLE - expressive, dynamic, stylized
   - LARGE EXPRESSIVE EYES with multiple highlights and detailed iris patterns
   - Sleek, flowing hair with defined strands and highlights
   - Cel-shaded coloring with clear separation between light and shadow areas
   - Dynamic action poses with movement and energy
   - Simplified nose and mouth, focus on eyes for expression
   - Vibrant colors with high contrast
   - Clean linework with varied line weight
   - AVOID: Western cartoon style, realistic proportions, painterly effects`,

      'comic-book': `   - AMERICAN COMIC BOOK STYLE - bold, dramatic, action-packed
   - STRONG BLACK INK OUTLINES with varied line weight for depth
   - Dynamic action poses and dramatic camera angles
   - Bold primary colors with high contrast
   - Strong shadows and highlights (chiaroscuro lighting)
   - Halftone dots or screen tones for texture and shading
   - Motion lines, speed lines, and action effects
   - Superhero comic aesthetic - powerful and energetic
   - AVOID: Soft watercolors, minimal style, subtle colors`,

      'fantasy-realistic': `   - FANTASY REALISM - detailed, magical, richly rendered
   - Realistic anatomical proportions and detailed textures
   - Rich, saturated colors with dramatic lighting
   - Painterly brushwork with visible strokes and blending
   - Magical elements rendered realistically (glowing effects, sparkles)
   - Intricate details in clothing, environment, and magical effects
   - Cinematic lighting with strong light sources and atmosphere
   - High fantasy art aesthetic (D&D, fantasy novels)
   - AVOID: Cartoon simplification, flat colors, minimal details`,

      'graphic-novel': `   - GRAPHIC NOVEL STYLE - sophisticated, cinematic, moody
   - Dramatic black and white contrast with limited color palette
   - Film noir inspired lighting and shadows
   - Mature artistic sensibility with complex compositions
   - Detailed linework with crosshatching and texture
   - Cinematic panel layouts and perspectives
   - Atmospheric mood through lighting and composition
   - Contemporary graphic novel aesthetic (think Saga, Monstress)
   - AVOID: Bright cheerful colors, simple cartoon style, flat design`,

      'realistic': `   - REALISTIC ILLUSTRATION STYLE - detailed, lifelike, highly polished
   - Highly detailed rendering with lifelike textures and materials
   - Realistic anatomical proportions and natural poses
   - Rich, nuanced color palette with natural tones and subtle variations
   - Detailed shading with smooth gradients and realistic lighting effects
   - Natural depth with atmospheric perspective and environmental detail
   - Intricate details in clothing, hair, skin, and environmental elements
   - Polished, professional illustration quality with fine details
   - Think high-end children's book illustrations (Chris Van Allsburg, Shaun Tan style)
   - AVOID: Cartoon simplification, flat colors, stylized features`,

      'photographic': `   - REALISTIC ILLUSTRATION STYLE - detailed, lifelike, highly polished
   - Highly detailed rendering with lifelike textures and materials
   - Realistic anatomical proportions and natural poses
   - Rich, nuanced color palette with natural tones and subtle variations
   - Detailed shading with smooth gradients and realistic lighting effects
   - Natural depth with atmospheric perspective and environmental detail
   - Intricate details in clothing, hair, skin, and environmental elements
   - Polished, professional illustration quality with fine details
   - Think high-end children's book illustrations (Chris Van Allsburg, Shaun Tan style)
   - AVOID: Cartoon simplification, flat colors, stylized features`,
    };

    return styleInstructions[illustrationStyle] || styleInstructions['watercolour'];
  }

  private buildConversationalImagePrompt(storyPage: any, illustrationStyle: string, childFirstName: string, pageIndex: number): string {
    // Rotate through varied camera angles and compositions for visual variety
    const cameraAngles = [
      'medium shot at eye level',
      'wide-angle shot showing the full scene',
      'close-up shot focusing on emotion',
      'low-angle perspective looking up',
      'over-the-shoulder view',
      'dynamic action shot with movement',
    ];
    const cameraAngle = cameraAngles[pageIndex % cameraAngles.length];

    let prompt = `Now create the next image for the story.\n\n`;
    prompt += `PAGE ${storyPage.page_number} SCENE:\n${storyPage.image_prompt}\n\n`;

    prompt += `CRITICAL REQUIREMENTS:\n`;
    prompt += `1. CHARACTER CONSISTENCY AND IDENTITY:\n`;
    prompt += `   - ${childFirstName} must look EXACTLY the same as in the reference photo I provided\n`;
    prompt += `   - Retain facial identity, eye color, hairstyle, hair color, and all appearance details from reference\n`;
    prompt += `   - ${childFirstName} should be immediately recognizable as the same person\n`;
    prompt += `   - IMPORTANT: Show ${childFirstName} ONCE and only once in the scene (no duplicates, no multiple instances)\n`;
    prompt += `   - If other people appear, they must look completely different from ${childFirstName}\n\n`;

    prompt += `2. COMPOSITION AND VARIETY:\n`;
    prompt += `   - Use ${cameraAngle} for this scene\n`;
    prompt += `   - Create a dynamic, engaging composition with ${childFirstName} in a natural, varied pose\n`;
    prompt += `   - Avoid repetitive poses - make each image visually distinct\n`;
    prompt += `   - ${childFirstName} can be standing, sitting, moving, reaching, looking in different directions\n`;
    prompt += `   - Vary the framing and perspective to keep each image interesting\n\n`;

    prompt += `3. ILLUSTRATION STYLE (CRITICAL - MAINTAIN EXACT STYLE):\n`;
    prompt += this.getDetailedStyleInstructions(illustrationStyle);
    prompt += `\n`;

    prompt += `4. AVOID THESE ISSUES (NEGATIVE GUIDANCE):\n`;
    prompt += `   - NO duplicated faces or multiple instances of ${childFirstName}\n`;
    prompt += `   - NO extra fingers or distorted hands\n`;
    prompt += `   - NO heavy blur or artifacts\n`;
    prompt += `   - NO double pupils or facial distortions\n\n`;

    prompt += `Create the illustration now. Remember: ${childFirstName} must match the reference photo exactly, appear ONCE only, with a fresh dynamic composition.`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
