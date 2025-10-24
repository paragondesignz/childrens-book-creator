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
        amount: 19.99,
        currency: 'usd',
        stripe_payment_intent_id: `mock_pi_${Date.now()}`,
        status: 'completed',
      })
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    // Update book status to processing
    const { error: updateError } = await supabase
      .from('book_orders')
      .update({ status: 'processing' })
      .eq('id', book.id);

    if (updateError) {
      throw updateError;
    }

    // Trigger book processing (we'll create this endpoint next)
    // For now, we'll just redirect to status page
    redirect(`/books/${book.id}/status`);
  } catch (error) {
    console.error('Mock payment error:', error);
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
