import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import PaymentForm from './PaymentForm';

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch book order
  const { data: book, error } = await supabase
    .from('book_orders')
    .select(`
      *,
      template:story_templates(*)
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !book) {
    redirect('/dashboard');
  }

  // Check if already paid
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('*')
    .eq('book_order_id', book.id)
    .eq('status', 'completed')
    .single();

  if (existingPayment) {
    redirect(`/books/${book.id}/status`);
  }

  const PRICE = 19.99; // Fixed price for now

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-primary">
            Storybooks
          </Link>
          <nav className="flex gap-4 items-center">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← Back to Dashboard
            </Link>
          </div>

          <h1 className="text-4xl font-bold mb-8">Complete Your Order</h1>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Order Summary */}
            <div>
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-2xl font-bold mb-6">Order Summary</h2>

                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="font-semibold mb-2">Story</h3>
                    {book.template ? (
                      <div>
                        <p className="font-medium text-primary">{book.template.title}</p>
                        <p className="text-sm text-gray-600">{book.template.description}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-primary">Custom Story</p>
                        <p className="text-sm text-gray-600 italic">"{book.custom_story_prompt}"</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Personalization</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>Child: {book.child_first_name}, {book.child_age} years old</p>
                      <p>Style: {book.illustration_style.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">What You'll Get</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>8-page personalized illustrated story</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>High-quality AI-generated illustrations</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>Digital PDF download</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>Printable format (A4/Letter)</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-t pt-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">${PRICE.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500">One-time payment, no subscription</p>
                </div>
              </div>
            </div>

            {/* Payment Section - Placeholder */}
            <div>
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-2xl font-bold mb-6">Payment Details</h2>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Development Mode</h4>
                  <p className="text-sm text-blue-800">
                    Payment integration will be added soon. For testing, you can skip to processing.
                  </p>
                </div>

                <PaymentForm bookId={book.id} />

                <div className="mt-6 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Secure payment processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Money-back guarantee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Instant access after payment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
