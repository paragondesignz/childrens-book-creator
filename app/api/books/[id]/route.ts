import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/books/[id]
 * Deletes a book order and all associated data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bookOrderId = params.id;

    // Verify the book belongs to the user
    const { data: bookOrder, error: fetchError } = await supabase
      .from('book_orders')
      .select('id, user_id, status')
      .eq('id', bookOrderId)
      .single();

    if (fetchError || !bookOrder) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    if (bookOrder.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this book' },
        { status: 403 }
      );
    }

    // Delete storage files first (images and PDFs)
    console.log(`[Delete Book ${bookOrderId}] Cleaning up storage files...`);

    // Delete generated images from storage
    const { data: imageFiles } = await supabase.storage
      .from('generated-images')
      .list(bookOrderId);

    if (imageFiles && imageFiles.length > 0) {
      const imagePaths = imageFiles.map(file => `${bookOrderId}/${file.name}`);
      const { error: imageDeleteError } = await supabase.storage
        .from('generated-images')
        .remove(imagePaths);

      if (imageDeleteError) {
        console.error('Error deleting images from storage:', imageDeleteError);
      } else {
        console.log(`[Delete Book ${bookOrderId}] Deleted ${imagePaths.length} image files`);
      }
    }

    // Delete generated PDF from storage
    const pdfPath = `${bookOrderId}/book.pdf`;
    const { error: pdfDeleteError } = await supabase.storage
      .from('generated-pdfs')
      .remove([pdfPath]);

    if (pdfDeleteError) {
      console.error('Error deleting PDF from storage:', pdfDeleteError);
    } else {
      console.log(`[Delete Book ${bookOrderId}] Deleted PDF file`);
    }

    // Delete uploaded images (child/pet photos)
    const { data: uploadedFiles } = await supabase.storage
      .from('uploaded-images')
      .list(bookOrderId);

    if (uploadedFiles && uploadedFiles.length > 0) {
      const uploadedPaths = uploadedFiles.map(file => `${bookOrderId}/${file.name}`);
      await supabase.storage.from('uploaded-images').remove(uploadedPaths);
    }

    // Delete database records in correct order (respecting foreign key constraints)
    console.log(`[Delete Book ${bookOrderId}] Deleting database records...`);

    // Get story_id first
    const { data: story } = await supabase
      .from('generated_stories')
      .select('id')
      .eq('book_order_id', bookOrderId)
      .single();

    // Delete in order: generated_images, generated_pdfs, story_pages, generated_stories, book_pets, uploaded_images, book_orders
    await supabase.from('generated_images').delete().eq('book_order_id', bookOrderId);
    await supabase.from('generated_pdfs').delete().eq('book_order_id', bookOrderId);
    
    if (story) {
      await supabase.from('story_pages').delete().eq('story_id', story.id);
    }
    
    await supabase.from('generated_stories').delete().eq('book_order_id', bookOrderId);
    await supabase.from('book_pets').delete().eq('book_order_id', bookOrderId);
    await supabase.from('uploaded_images').delete().eq('book_order_id', bookOrderId);

    // Finally, delete the book_order itself
    const { error: bookOrderError } = await supabase
      .from('book_orders')
      .delete()
      .eq('id', bookOrderId);

    if (bookOrderError) {
      console.error('Error deleting book_order:', bookOrderError);
      return NextResponse.json(
        { error: 'Failed to delete book order', details: bookOrderError.message },
        { status: 500 }
      );
    }

    console.log(`[Delete Book ${bookOrderId}] ✓ Successfully deleted all data`);

    return NextResponse.json(
      {
        success: true,
        message: 'Book deleted successfully',
        bookOrderId
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
