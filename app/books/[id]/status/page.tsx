import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { StatusMonitor } from './StatusMonitor';

export default async function BookStatusPage({ params }: { params: { id: string } }) {
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
      template:story_templates(*),
      generated_story:generated_stories(*),
      generated_pdf:generated_pdfs(*)
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !book) {
    redirect('/dashboard');
  }

  // If completed, redirect to preview
  if (book.status === 'completed' && book.generated_pdf) {
    redirect(`/books/${book.id}/preview`);
  }

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
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← Back to Dashboard
            </Link>
          </div>

          <h1 className="text-4xl font-bold mb-2">Creating Your Story</h1>
          <p className="text-gray-600 mb-8">
            We're generating {book.child_first_name}'s personalized storybook. This usually takes 5-10 minutes.
          </p>

          <StatusMonitor bookId={book.id} initialStatus={book.status} />

          <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="font-semibold text-lg mb-4">What's Happening?</h2>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Story Generation</p>
                  <p>Our AI is creating a unique 15-page story featuring {book.child_first_name}, incorporating their interests and personality traits.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Illustration Creation</p>
                  <p>Each page is being illustrated in the {book.illustration_style.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} style you selected.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">PDF Assembly</p>
                  <p>We're combining the story and illustrations into a beautiful, printable PDF.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Keep this window open</p>
                <p>You can also check back later - we'll email you when your book is ready!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
