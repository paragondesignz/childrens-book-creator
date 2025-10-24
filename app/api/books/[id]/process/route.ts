import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Trigger book generation asynchronously (fire and forget)
    // This calls the cron endpoint which handles the actual processing
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || `${protocol}://${host}`;

    console.log('[process] Triggering async processing at:', `${appUrl}/api/cron/process-books`);

    // Fire and forget - don't wait for response
    fetch(`${appUrl}/api/cron/process-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookOrderId: book.id }),
    }).catch(error => {
      console.error('[process] Failed to trigger async processing:', error);
      // Error is logged but doesn't affect response to user
    });

    return NextResponse.json({
      message: 'Book processing started',
      bookId: book.id,
      status: 'processing',
    });
  } catch (error) {
    console.error('[process] Process book error:', error);
    return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 });
  }
}
