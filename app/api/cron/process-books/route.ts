import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StoryGenerationService } from '@/services/storyGeneration.service';
import { ImageGenerationService } from '@/services/imageGeneration.service';
import { PDFGenerationService } from '@/services/pdfGeneration.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// This endpoint processes books without requiring Redis/BullMQ
// Runs automatically every 5 minutes via Vercel Cron (see vercel.json)
// Can also be called manually via POST with { bookOrderId: "..." }

export const maxDuration = 300; // 5 minutes (Vercel Pro plan limit)
export const dynamic = 'force-dynamic';

export async function processBookOrder(bookOrderId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[process-books] Starting processing for book: ${bookOrderId}`);

    // Fetch book order data
    const { data: bookOrder, error: fetchError } = await supabase
      .from('book_orders')
      .select(`
        *,
        template:story_templates(*),
        pets:book_pets(*)
      `)
      .eq('id', bookOrderId)
      .single();

    if (fetchError || !bookOrder) {
      throw new Error(`Failed to fetch book order: ${fetchError?.message}`);
    }

    console.log(`[process-books] Current status: ${bookOrder.status}`);

    // Check what's already been done
    const { data: existingStory } = await supabase
      .from('generated_stories')
      .select('id, title')
      .eq('book_order_id', bookOrderId)
      .single();

    const { data: existingImages, count: imageCount } = await supabase
      .from('generated_images')
      .select('id', { count: 'exact' })
      .eq('book_order_id', bookOrderId);

    const { data: existingPdf } = await supabase
      .from('generated_pdfs')
      .select('id')
      .eq('book_order_id', bookOrderId)
      .single();

    console.log(`[process-books] Already done - Story: ${!!existingStory}, Images: ${imageCount}/8, PDF: ${!!existingPdf}`);

    // Step 1: Generate Story (if not already done)
    let generatedStory: { id: string; title: string; pages: any[] } | null = null;

    if (!existingStory) {
      console.log(`[process-books] Generating story for ${bookOrder.child_first_name}...`);
      await supabase
        .from('book_orders')
        .update({ status: 'generating-story' })
        .eq('id', bookOrderId);

      const storyService = new StoryGenerationService();
      generatedStory = await storyService.generateStory({
        bookOrderId,
        templateId: bookOrder.template_id,
        childFirstName: bookOrder.child_first_name,
        childAge: bookOrder.child_age,
        childGender: bookOrder.child_gender,
        favouriteColours: bookOrder.favourite_colours || [],
        interests: bookOrder.interests || [],
        personalityTraits: bookOrder.personality_traits || [],
        customPrompt: bookOrder.custom_story_prompt,
        pets: bookOrder.pets || [],
      });

      console.log(`[process-books] Story generated: ${generatedStory?.title || 'Unknown'}`);
    } else {
      console.log(`[process-books] Story already exists, skipping...`);

      // Fetch story pages for existing story
      const { data: storyPages } = await supabase
        .from('story_pages')
        .select('*')
        .eq('story_id', existingStory.id)
        .order('page_number', { ascending: true });

      generatedStory = {
        id: existingStory.id,
        title: existingStory.title,
        pages: storyPages || []
      };
    }

    // Step 2-4: Generate ALL images (covers + pages) in ONE conversation for consistency
    const { data: existingFrontCover } = await supabase
      .from('generated_images')
      .select('id')
      .eq('book_order_id', bookOrderId)
      .eq('page_number', 0)
      .single();

    const { data: existingBackCover } = await supabase
      .from('generated_images')
      .select('id')
      .eq('book_order_id', bookOrderId)
      .eq('page_number', 16)
      .single();

    // Check if we need to generate any images
    const needsFrontCover = !existingFrontCover;
    const needsBackCover = !existingBackCover;
    const needsPageImages = !imageCount || imageCount < 6;

    if (needsFrontCover || needsBackCover || needsPageImages) {
      console.log(`[process-books] Generating images in conversation: Front=${needsFrontCover}, Pages=${needsPageImages}, Back=${needsBackCover}`);

      await supabase
        .from('book_orders')
        .update({ status: 'generating-images' })
        .eq('id', bookOrderId);

      const imageService = new ImageGenerationService();
      const generatedImages = await imageService.generateImagesForStory({
        storyId: generatedStory!.id,
        bookOrderId,
        pages: generatedStory!.pages,
        illustrationStyle: bookOrder.illustration_style,
        childFirstName: bookOrder.child_first_name,
        storyTitle: generatedStory!.title,
        generateCovers: true, // Generate covers in same conversation
      });

      console.log(`[process-books] ✓ All ${generatedImages.length} images generated (covers + pages) with conversation consistency`);
    } else {
      console.log(`[process-books] All images already exist, skipping...`);
    }

    // Step 5: Fetch all generated images for PDF
    const { data: allImages } = await supabase
      .from('generated_images')
      .select('*')
      .eq('book_order_id', bookOrderId)
      .order('page_number', { ascending: true });

    // Step 6: Generate PDF (if not already done)
    let pdfResult;
    if (!existingPdf) {
      console.log(`[process-books] Creating PDF...`);
      await supabase
        .from('book_orders')
        .update({ status: 'creating-pdf' })
        .eq('id', bookOrderId);

      const pdfService = new PDFGenerationService();
      pdfResult = await pdfService.generatePDF({
        bookOrderId,
        storyId: generatedStory!.id,
        title: bookOrder.template?.title || `${bookOrder.child_first_name}'s Story`,
        pages: generatedStory!.pages,
        images: allImages!,
      });

      console.log(`[process-books] PDF generated: ${pdfResult.id}`);
    } else {
      console.log(`[process-books] PDF already exists, skipping...`);
      pdfResult = existingPdf;
    }

    // Step 7: Mark as completed
    await supabase
      .from('book_orders')
      .update({
        status: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', bookOrderId);

    console.log(`[process-books] Book processing completed for: ${bookOrderId}`);

    return {
      success: true,
      bookOrderId,
      storyId: generatedStory!.id,
      pdfId: pdfResult?.id,
    };
  } catch (error: any) {
    console.error(`[process-books] Book processing failed:`, error);

    // Update status to failed
    await supabase
      .from('book_orders')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error occurred'
      })
      .eq('id', bookOrderId);

    throw error;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find books that need processing (any intermediate state)
    const { data: pendingBooks, error } = await supabase
      .from('book_orders')
      .select('id, child_first_name, created_at, status')
      .in('status', ['processing', 'generating-story', 'generating-images', 'creating-pdf'])
      .order('created_at', { ascending: true })
      .limit(1); // Process one at a time to avoid timeouts

    if (error) {
      throw error;
    }

    if (!pendingBooks || pendingBooks.length === 0) {
      return NextResponse.json({
        message: 'No books pending processing',
        processed: 0
      });
    }

    const results = [];
    for (const book of pendingBooks) {
      try {
        const result = await processBookOrder(book.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process book ${book.id}:`, error);
        results.push({
          success: false,
          bookOrderId: book.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: 'Book processing completed',
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('[process-books] Cron job error:', error);
    return NextResponse.json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Allow manual POST trigger with specific book ID
export async function POST(req: NextRequest) {
  try {
    const { bookOrderId } = await req.json();

    if (!bookOrderId) {
      return NextResponse.json({ error: 'bookOrderId required' }, { status: 400 });
    }

    const result = await processBookOrder(bookOrderId);

    return NextResponse.json({
      message: 'Book processed successfully',
      result
    });
  } catch (error) {
    console.error('[process-books] Manual processing error:', error);
    return NextResponse.json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
