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

    // Adaptive opening based on style - photographic needs different language
    const isPhotographic = illustrationStyle === 'photographic';
    let prompt = isPhotographic
      ? `Create a professional photorealistic children's book image that looks like a real photograph.\n\n`
      : `Create a professional children's book illustration.\n\n`;

    prompt += `VISUAL STYLE: ${styleGuide}\n\n`;

    if (isPhotographic) {
      prompt += `CRITICAL - PHOTOREALISTIC REQUIREMENTS:\n`;
      prompt += `- This must look like a REAL PHOTOGRAPH, not an illustration or drawing\n`;
      prompt += `- Use natural camera angles and realistic depth of field\n`;
      prompt += `- Natural lighting as if photographed in real life\n`;
      prompt += `- Real-world textures, materials, and environments\n`;
      prompt += `- Authentic photography aesthetic - absolutely NO illustrated or painted look\n\n`;
    }

    prompt += `IMPORTANT CHARACTER CONSISTENCY:\n`;
    prompt += `- The main character is ${childFirstName}, shown in the reference image provided\n`;
    prompt += `- Keep the EXACT same face, hair color, hair style, eye color, and physical features from the reference\n`;
    prompt += `- Ensure ${childFirstName} is immediately recognizable as the same person\n`;
    prompt += `- Maintain consistent age appearance and proportions\n\n`;
    prompt += `SCENE: ${storyPage.image_prompt}\n\n`;
    prompt += `COMPOSITION REQUIREMENTS:\n`;
    prompt += `- Full-page ${isPhotographic ? 'photograph' : 'illustration'} focusing entirely on the visual scene\n`;
    prompt += `- Bright, inviting, child-friendly colors that spark joy\n`;
    prompt += `- Safe, warm, age-appropriate content perfect for young readers\n`;
    prompt += `- Professional ${isPhotographic ? 'photography' : 'storybook'} quality with rich details and textures\n`;
    prompt += `- ${childFirstName} as the clear focal point of the composition\n`;
    prompt += `- Engaging, dynamic composition that captures attention and imagination`;

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
      ? `Create a stunning children's book front cover that looks like a professional photograph.\n\n`
      : `Create a stunning children's book front cover illustration.\n\n`;

    prompt += `TEXT TO RENDER:\n`;
    prompt += `- At the top of the cover, render the title text "${storyTitle}" in large, bold, playful serif font suitable for children's books\n`;
    prompt += `- At the bottom of the cover, render the subtitle "Starring ${childFirstName}" in an elegant, flowing script font\n`;
    prompt += `- Ensure all text is perfectly legible, well-spaced, and professionally typeset\n\n`;
    prompt += `VISUAL STYLE: ${styleGuide} with vibrant, inviting colors and professional book cover aesthetic\n\n`;

    if (isPhotographic) {
      prompt += `CRITICAL - PHOTOREALISTIC REQUIREMENTS:\n`;
      prompt += `- This must look like a REAL PHOTOGRAPH, not an illustration or drawing\n`;
      prompt += `- Natural camera angles and realistic depth of field\n`;
      prompt += `- Authentic photography lighting and composition\n`;
      prompt += `- Real-world environment and materials\n\n`;
    }

    prompt += `MAIN CHARACTER: ${childFirstName} from the reference image provided - maintain EXACT same facial features, hair, and appearance\n\n`;
    prompt += `SCENE COMPOSITION: Feature ${childFirstName} as the hero in an enchanting, magical scene that sparks imagination. The character should be prominently displayed in the center-lower portion of the cover, with the scene creating a sense of wonder and adventure. Rich details, dynamic lighting, and a composition that draws the eye to both the character and the title text.`;

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
      ? `Create a beautiful children's book back cover that looks like a professional photograph.\n\n`
      : `Create a beautiful children's book back cover illustration.\n\n`;

    prompt += `VISUAL STYLE: ${styleGuide} with warm, inviting colors and professional book cover aesthetic\n\n`;

    if (isPhotographic) {
      prompt += `CRITICAL - PHOTOREALISTIC REQUIREMENTS:\n`;
      prompt += `- This must look like a REAL PHOTOGRAPH, not an illustration\n`;
      prompt += `- Natural camera angles and authentic photography aesthetic\n`;
      prompt += `- Real-world lighting and environment\n\n`;
    }

    prompt += `MAIN CHARACTER: ${childFirstName} from the reference image provided - maintain EXACT same facial features, hair, and appearance\n\n`;
    prompt += `SCENE COMPOSITION: A decorative, whimsical scene in a magical, enchanting setting that complements the story's theme. Pure visual ${isPhotographic ? 'photograph' : 'illustration'} showcasing ${childFirstName} in a memorable, heartwarming moment. The scene should feel safe, joyful, and age-appropriate, with rich ${isPhotographic ? 'photographic' : 'artistic'} details and a composition that creates emotional connection and wonder.`;

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

    if (isPhotographic) {
      prompt += `STYLE REQUIREMENTS FOR ALL IMAGES:\n`;
      prompt += `- Every image must look like a REAL PHOTOGRAPH, not illustrated or drawn\n`;
      prompt += `- Use natural camera angles and realistic depth of field\n`;
      prompt += `- Professional photography lighting and composition\n`;
      prompt += `- Real-world environments, materials, and textures\n`;
      prompt += `- Authentic photographic aesthetic throughout\n\n`;
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
    prompt += `- Maintain the exact same visual style for all pages\n`;
    prompt += `- Only the scene/setting/action should change - NOT ${childFirstName}'s appearance or the art style\n\n`;

    prompt += `Please confirm you understand by acknowledging the character's key features and the style we'll use.`;

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

    let prompt = `Now generate the next image for the story.\n\n`;
    prompt += `PAGE ${storyPage.page_number} SCENE:\n${storyPage.image_prompt}\n\n`;

    prompt += `CRITICAL REMINDERS:\n`;
    prompt += `- ${childFirstName} must look EXACTLY the same as in the reference photo and previous images\n`;
    prompt += `- Keep the SAME facial features, hair, eyes, and appearance\n`;
    prompt += `- Maintain the ${isPhotographic ? 'photographic' : 'illustration'} style consistently\n`;

    if (isPhotographic) {
      prompt += `- This MUST look like a real photograph, NOT illustrated or drawn\n`;
      prompt += `- Use natural camera angles and realistic photography lighting\n`;
    }

    prompt += `\nCreate this image now, ensuring ${childFirstName} is immediately recognizable as the same person from the reference.`;

    return prompt;
  }
}

export const imageGenerationService = new ImageGenerationService();
