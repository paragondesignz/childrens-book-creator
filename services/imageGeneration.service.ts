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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

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
      console.log(`Generating images for ${pages.length} pages using conversation-based approach for consistency...`);

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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

      // Initialize chat with character context
      const chat = model.startChat({
        history: [],
      });

      // Send initial context message with reference photo
      if (referenceImageData) {
        const characterContextPrompt = this.buildCharacterContextPrompt(childFirstName, illustrationStyle);
        await chat.sendMessage([
          referenceImageData,
          { text: characterContextPrompt }
        ]);
        console.log('Character context established in conversation');
      }

      const generatedImages = [];

      // Generate images SEQUENTIALLY in the same conversation for consistency
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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

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

    let prompt = isPhotographic
      ? `I need you to help me create a photo story with consistent ${styleDesc} of real scenes.\n\n`
      : `I need you to help me create a children's book with consistent ${styleDesc}.\n\n`;

    prompt += `CRITICAL CHARACTER REFERENCE:\n`;
    prompt += `This is ${childFirstName}, the main character of our story. Study this person's appearance VERY carefully:\n`;
    prompt += `- Exact facial features (face shape, nose, mouth, chin)\n`;
    prompt += `- Precise hair color, hair style, and hair texture\n`;
    prompt += `- Specific eye color and eye shape\n`;
    prompt += `- Skin tone and complexion\n`;
    prompt += `- Age appearance and body proportions\n`;
    prompt += `- Any distinctive features or characteristics\n\n`;

    if (isPhotographic) {
      prompt += `STYLE REQUIREMENTS FOR ALL IMAGES:\n`;
      prompt += `- Every image must be a REAL PHOTOGRAPH - shot with actual camera, not drawn/illustrated/painted/digital art\n`;
      prompt += `- Professional camera work - DSLR or mirrorless camera aesthetics (Canon/Nikon/Sony style)\n`;
      prompt += `- Natural camera settings - realistic depth of field, natural bokeh, proper exposure\n`;
      prompt += `- Real photography lighting - golden hour outdoors, window light indoors, or professional photo studio lighting\n`;
      prompt += `- Real physical locations and environments - actual places, not illustrated or painted backdrops\n`;
      prompt += `- Editorial/lifestyle photography aesthetic - like magazine photography or professional family portraits\n`;
      prompt += `- Authentic photographic look throughout all images - NO illustration, cartoon, or art style\n\n`;
    } else {
      prompt += `STYLE REQUIREMENTS FOR ALL IMAGES:\n`;
      prompt += `- Every image must be in the same ${styleDesc} style\n`;
      prompt += `- Consistent artistic approach across all pages\n`;
      prompt += `- Coherent visual aesthetic throughout the book\n\n`;
    }

    prompt += `CONSISTENCY RULES:\n`;
    prompt += `- ${childFirstName} MUST look EXACTLY the same in every image\n`;
    prompt += `- Keep the SAME face, hair, eyes, and physical features in all images\n`;
    prompt += `- ${childFirstName} should be immediately recognizable as the same person\n`;
    prompt += `- Maintain the exact same ${isPhotographic ? 'photographic' : 'artistic'} style for all pages\n`;
    prompt += `- Only the scene/setting/action should change - NOT ${childFirstName}'s appearance or the ${isPhotographic ? 'photography' : 'art'} style\n\n`;

    prompt += `Please confirm you understand by acknowledging the character's key features and the ${isPhotographic ? 'photographic' : 'illustration'} style we'll use.`;

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

      // Send message in conversation - optionally include reference again for extra reinforcement
      const messageParts: any[] = [];

      // Include reference image periodically for reinforcement (every 5 pages)
      if (referenceImageData && (pageIndex === 0 || pageIndex % 5 === 0)) {
        messageParts.push(referenceImageData);
        console.log(`[Page ${storyPage.page_number}] Reinforcing reference image`);
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
   * Builds a conversational image prompt that maintains context
   */
  private buildConversationalImagePrompt(storyPage: any, illustrationStyle: string, childFirstName: string, pageIndex: number): string {
    const isPhotographic = illustrationStyle === 'photographic';

    let prompt = `Now ${isPhotographic ? 'photograph' : 'create'} the next ${isPhotographic ? 'scene' : 'image'} for the story.\n\n`;
    prompt += `PAGE ${storyPage.page_number} SCENE:\n${storyPage.image_prompt}\n\n`;

    prompt += `CRITICAL REMINDERS:\n`;
    prompt += `- ${childFirstName} must look EXACTLY the same as in the reference photo and previous images\n`;
    prompt += `- Keep the SAME facial features, hair, eyes, and appearance\n`;
    prompt += `- Maintain the ${isPhotographic ? 'photographic' : 'illustration'} style consistently\n`;

    if (isPhotographic) {
      prompt += `- This MUST be a REAL PHOTOGRAPH shot with a camera, NOT illustrated, drawn, painted, or digital art\n`;
      prompt += `- Professional camera work with natural angles, realistic depth of field, and authentic bokeh\n`;
      prompt += `- Natural real-world photography lighting - outdoor daylight or indoor ambient/studio lighting\n`;
      prompt += `- Real physical environment and actual location\n`;
    }

    prompt += `\n${isPhotographic ? 'Photograph' : 'Create'} this ${isPhotographic ? 'scene' : 'image'} now, ensuring ${childFirstName} is immediately recognizable as the same person from the reference.`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
