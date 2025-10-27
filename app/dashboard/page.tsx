import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { DeleteBookButton } from '@/app/components/DeleteBookButton';

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's books
  const { data: books } = await supabase
    .from('book_orders')
    .select(`
      *,
      template:story_templates(*),
      generated_pdf:generated_pdfs(*),
      payments(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const handleSignOut = async () => {
    'use server';
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-primary">
            Storybooks
          </Link>
          <nav className="flex gap-4 items-center">
            <Link href="/dashboard" className="text-gray-900 font-medium">
              Dashboard
            </Link>
            <Link href="/create" className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90">
              Create Story
            </Link>
            <form action={handleSignOut}>
              <button type="submit" className="text-gray-600 hover:text-gray-900">
                Sign Out
              </button>
            </form>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Storybooks</h1>
          <p className="text-gray-600">Create and manage your personalized children's books</p>
        </div>

        {/* Create New Book CTA */}
        <div className="bg-gradient-to-r from-primary to-blue-600 rounded-lg p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Create a New Story</h2>
          <p className="mb-4 opacity-90">Bring your child's imagination to life with AI-generated illustrations</p>
          <Link
            href="/create"
            className="inline-block bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Start Creating
          </Link>
        </div>

        {/* Books Grid */}
        {books && books.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => {
              const paidPayment = book.payments?.find((p: any) => p.status === 'completed');
              const canProcess = paidPayment && book.status === 'draft';

              return (
                <div key={book.id} className="bg-white rounded-lg shadow-sm border p-6 relative">
                  {/* Delete button in top-right corner */}
                  <div className="absolute top-4 right-4">
                    <DeleteBookButton
                      bookId={book.id}
                      bookTitle={`${book.child_first_name}'s Story`}
                    />
                  </div>

                  <div className="mb-4 pr-8">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        book.status === 'completed' ? 'bg-green-100 text-green-800' :
                        book.status === 'processing' || book.status === 'generating-story' || book.status === 'generating-images' || book.status === 'creating-pdf' ? 'bg-blue-100 text-blue-800' :
                        book.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {book.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(book.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg">{book.child_first_name}'s Story</h3>
                    {book.template && (
                      <p className="text-sm text-gray-600 mt-1">{book.template.title}</p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <p>Age: {book.child_age} years old</p>
                    <p>Style: {book.illustration_style}</p>
                  </div>

                  <div className="flex gap-2">
                    {book.status === 'completed' && book.generated_pdf && (
                      <Link
                        href={`/books/${book.id}/preview`}
                        className="flex-1 text-center bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm"
                      >
                        View Book
                      </Link>
                    )}
                    {canProcess && (
                      <form action={`/api/books/${book.id}/process`} method="POST" className="flex-1">
                        <button
                          type="submit"
                          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                        >
                          Start Processing
                        </button>
                      </form>
                    )}
                    {!paidPayment && book.status === 'draft' && (
                      <Link
                        href={`/books/${book.id}/checkout`}
                        className="flex-1 text-center bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm"
                      >
                        Complete Payment
                      </Link>
                    )}
                    {(book.status === 'processing' || book.status.includes('generating') || book.status === 'creating-pdf') && (
                      <Link
                        href={`/books/${book.id}/status`}
                        className="flex-1 text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                      >
                        View Progress
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">No books yet</h3>
            <p className="text-gray-600 mb-6">Create your first personalized storybook!</p>
            <Link
              href="/create"
              className="inline-block bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              Create Your First Story
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
