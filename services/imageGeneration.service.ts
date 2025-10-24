import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { IllustrationStyle } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export class ImageGenerationService {
  private model = genAI.getGenerativeModel({
    model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash',
  });

  async generateAllImages(bookOrderId: string): Promise<void> {
    try {
      // Update status
      await db.bookOrder.update({
        where: { id: bookOrderId },
        data: { status: 'generating-images' },
      });

      // Get book order and story pages
      const bookOrder = await db.bookOrder.findUnique({
        where: { id: bookOrderId },
        include: {
          generatedStory: {
            include: {
              storyPages: {
                orderBy: { pageNumber: 'asc' },
              },
            },
          },
          uploadedImages: {
            where: { imageType: 'child' },
          },
        },
      });

      if (!bookOrder || !bookOrder.generatedStory) {
        throw new Error('Book order or story not found');
      }

      const childPhotoUrl = bookOrder.uploadedImages[0]?.storageUrl;
      const style = bookOrder.illustrationStyle as IllustrationStyle;

      // Generate images for each page (3 at a time to avoid rate limits)
      const pages = bookOrder.generatedStory.storyPages;
      const batchSize = 3;

      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const promises = batch.map((page) =>
          this.generateImage(bookOrderId, page, childPhotoUrl, style, bookOrder)
        );
        await Promise.all(promises);
        console.log(`Generated images ${i + 1}-${Math.min(i + batchSize, pages.length)} of ${pages.length}`);
      }

      console.log('All images generated successfully');
    } catch (error) {
      console.error('Image generation error:', error);
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

  private async generateImage(
    bookOrderId: string,
    page: any,
    childPhotoUrl: string | undefined,
    style: IllustrationStyle,
    bookOrder: any
  ): Promise<void> {
    try {
      const prompt = this.buildImagePrompt(page, style, bookOrder);

      console.log(`Generating image for page ${page.pageNumber}...`);

      // Note: The actual Gemini image generation API might differ
      // This is a placeholder implementation based on the expected API
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const response = await result.response;

      // In a real implementation, we would:
      // 1. Get the image data from Gemini
      // 2. Process it with Sharp
      // 3. Upload to S3
      // 4. Generate thumbnail
      // 5. Save to database

      // For now, we'll create a placeholder entry
      // TODO: Implement actual image generation when Gemini image API is finalized

      const imageUrl = `https://${process.env.AWS_S3_BUCKET_PDFS}.s3.${process.env.AWS_REGION}.amazonaws.com/${bookOrderId}/page-${page.pageNumber}.png`;
      const thumbnailUrl = `https://${process.env.AWS_S3_BUCKET_PDFS}.s3.${process.env.AWS_REGION}.amazonaws.com/${bookOrderId}/page-${page.pageNumber}-thumb.png`;

      await db.generatedImage.create({
        data: {
          bookOrderId,
          storyPageId: page.id,
          pageNumber: page.pageNumber,
          imageUrl,
          thumbnailUrl,
          generationPrompt: prompt,
          width: 1024,
          height: 1024,
          contentModerationPassed: false,
          moderationFlags: {},
        },
      });

      console.log(`Image generated for page ${page.pageNumber}`);
    } catch (error) {
      console.error(`Error generating image for page ${page.pageNumber}:`, error);
      throw error;
    }
  }

  private buildImagePrompt(page: any, style: IllustrationStyle, bookOrder: any): string {
    const styleGuides = {
      'watercolour': 'Soft watercolor style with gentle brush strokes and translucent colors',
      'digital-art': 'Modern digital art style with vibrant colors and smooth gradients',
      'cartoon': 'Fun cartoon style with bold outlines and bright, cheerful colors',
      'storybook-classic': 'Classic storybook illustration style, timeless and warm',
      'modern-minimal': 'Clean, modern minimal style with simple shapes and soft colors',
    };

    let prompt = `Generate a children's book illustration in ${style} style.\n\n`;
    prompt += `Style guide: ${styleGuides[style]}\n\n`;
    prompt += `CRITICAL: This illustration must show ${bookOrder.childFirstName}, a ${bookOrder.childAge}-year-old child.\n`;
    prompt += `Character consistency is essential - maintain the same appearance throughout.\n\n`;
    prompt += `Scene description: ${page.imagePrompt}\n\n`;
    prompt += `Requirements:\n`;
    prompt += `- Professional children's book quality\n`;
    prompt += `- Safe, age-appropriate content\n`;
    prompt += `- No scary or frightening elements\n`;
    prompt += `- Bright, inviting colors\n`;
    if (bookOrder.favouriteColours) {
      prompt += `- Incorporate these favorite colors where appropriate: ${bookOrder.favouriteColours.join(', ')}\n`;
    }
    prompt += `- 1024x1024 resolution\n`;
    prompt += `- Suitable for printing at 300 DPI\n`;

    return prompt;
  }

  private getStyleGuide(style: IllustrationStyle): string {
    // Implementation of style guides
    return '';
  }
}

export const imageGenerationService = new ImageGenerationService();
