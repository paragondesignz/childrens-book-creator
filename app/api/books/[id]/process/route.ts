import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Import the processing function to call it directly
async function processBookOrder(bookOrderId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  // Call the cron endpoint directly (serverless function)
  const response = await fetch(`${appUrl}/api/cron/process-books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookOrderId }),
  });

  return response.json();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[process] Starting book processing for:', params.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('[process] No user authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify book belongs to user
    const { data: book, error: bookError } = await supabase
      .from('book_orders')
      .select('*, payments(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (bookError || !book) {
      console.log('[process] Book not found or error:', bookError);
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Check if payment is completed
    const hasCompletedPayment = book.payments?.some((p: any) => p.status === 'completed');
    if (!hasCompletedPayment) {
      console.log('[process] No completed payment found');
      return NextResponse.json({ error: 'Payment required' }, { status: 402 });
    }

    // Check if already processing or completed
    if (book.status !== 'draft' && book.status !== 'failed') {
      console.log('[process] Book already processing or completed:', book.status);
      return NextResponse.json({ error: 'Book is already being processed or completed' }, { status: 400 });
    }

    // Update status to processing
    const { error: updateError } = await supabase
      .from('book_orders')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', book.id);

    if (updateError) {
      console.error('[process] Failed to update status:', updateError);
      throw updateError;
    }

    console.log('[process] Book status updated to processing');

    // Trigger processing immediately in background (fire-and-forget)
    // If it times out on Vercel, the cron job will resume from where it left off
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

    console.log(`[process] Triggering immediate background processing...`);

    // Fire-and-forget: trigger processing but don't wait for response
    // This starts the generation immediately without blocking the HTTP response
    processBookOrder(book.id).catch(error => {
      console.error('[process] Background processing error (will be retried by cron):', error);
    });

    return NextResponse.json({
      message: 'Book processing started - generation takes 10-20 minutes. You\'ll receive an email when complete.',
      bookId: book.id,
      status: 'processing',
      estimatedTimeMinutes: 15,
    });
  } catch (error) {
    console.error('[process] Process book error:', error);
    return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 });
  }
}
