import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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
      redirect(`/books/${book.id}/status`);
    }

    // Create mock payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        book_order_id: book.id,
        user_id: user.id,
        amount_nzd: 19.99,
        currency: 'NZD',
        stripe_payment_intent_id: `mock_pi_${Date.now()}`,
        product_tier: 'pdf-only',
        status: 'completed',
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment insert error:', paymentError);
      throw paymentError;
    }

    // Trigger book processing
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    console.log('Triggering processing at:', `${appUrl}/api/books/${book.id}/process`);

    const processResponse = await fetch(`${appUrl}/api/books/${book.id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
    });

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error('Failed to trigger processing:', processResponse.status, errorText);
    } else {
      console.log('Processing triggered successfully');
    }

    // Redirect to status page
    redirect(`/books/${book.id}/status`);
  } catch (error) {
    console.error('Mock payment error:', error);
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
