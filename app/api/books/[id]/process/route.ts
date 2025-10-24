import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bookQueue } from '@/lib/queues/bookQueue';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
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
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Check if payment is completed
    const hasCompletedPayment = book.payments?.some((p: any) => p.status === 'completed');
    if (!hasCompletedPayment) {
      return NextResponse.json({ error: 'Payment required' }, { status: 402 });
    }

    // Check if already processing or completed
    if (book.status !== 'draft' && book.status !== 'failed') {
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
      throw updateError;
    }

    // Try to add job to queue, but don't fail if queue is unavailable
    // (This is expected in serverless environments without a worker)
    try {
      await bookQueue.add('process-book', {
        bookOrderId: book.id,
        userId: user.id,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
      console.log('[process] Job added to queue successfully');
    } catch (queueError) {
      console.warn('[process] Queue unavailable (worker not running):', queueError instanceof Error ? queueError.message : 'Unknown error');
      // Continue without queue - status is already updated to 'processing'
      // A worker can pick this up later, or you can process manually
    }

    return NextResponse.json({
      message: 'Book processing started',
      bookId: book.id,
      status: 'processing',
      note: 'Worker process required for actual book generation'
    });
  } catch (error) {
    console.error('Process book error:', error);
    return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 });
  }
}
