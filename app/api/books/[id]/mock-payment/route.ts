import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[mock-payment] Starting payment processing for book:', params.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('[mock-payment] No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[mock-payment] User authenticated:', user.id);

    // Verify book belongs to user
    const { data: book, error: bookError } = await supabase
      .from('book_orders')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('book_order_id', book.id)
      .eq('status', 'completed')
      .single();

    if (existingPayment) {
      return NextResponse.json({
        success: true,
        redirectUrl: `/books/${book.id}/status`,
        message: 'Payment already exists'
      });
    }

    // Create mock payment record
    console.log('[mock-payment] Creating payment record for book:', book.id);
    const paymentData = {
      book_order_id: book.id,
      user_id: user.id,
      amount_nzd: '19.99', // Decimal type requires string
      currency: 'NZD',
      stripe_payment_intent_id: `mock_pi_${Date.now()}`,
      product_tier: 'pdf-only',
      status: 'completed',
      paid_at: new Date().toISOString(),
    };
    console.log('[mock-payment] Payment data:', paymentData);

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      console.error('[mock-payment] Payment insert error:', {
        message: paymentError.message,
        details: paymentError.details,
        hint: paymentError.hint,
        code: paymentError.code
      });
      throw paymentError;
    }
    console.log('[mock-payment] Payment created successfully:', payment.id);

    // Mark book as ready for processing
    const { error: statusError } = await supabase
      .from('book_orders')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', book.id);

    if (statusError) {
      console.error('[mock-payment] Failed to update book status:', statusError);
    } else {
      console.log('[mock-payment] Book marked for processing - triggering immediate processing');
    }

    // Trigger immediate processing (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    console.log('[mock-payment] Triggering processing at:', `${appUrl}/api/cron/process-books`);

    // Fire-and-forget: start processing immediately without waiting
    fetch(`${appUrl}/api/cron/process-books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookOrderId: book.id }),
    }).catch(error => {
      console.error('[mock-payment] Failed to trigger processing (will be picked up by cron):', error);
    });

    // Return success with redirect URL immediately
    return NextResponse.json({
      success: true,
      redirectUrl: `/books/${book.id}/status`,
      paymentId: payment.id,
      bookId: book.id
    });
  } catch (error) {
    console.error('[mock-payment] ERROR:', error);
    console.error('[mock-payment] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    return NextResponse.json({
      error: 'Payment processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
