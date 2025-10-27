import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function BookPreviewPage({ params }: { params: { id: string } }) {
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

  // If not completed, redirect to status page
  if (book.status !== 'completed' || !book.generated_pdf) {
    redirect(`/books/${book.id}/status`);
  }

  const pdfUrl = book.generated_pdf.pdf_url;

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
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← Back to Dashboard
            </Link>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">{book.child_first_name}'s Story</h1>
              <p className="text-gray-600">
                {book.template ? book.template.title : 'Custom Story'}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/books/${book.id}/read`}
                className="bg-primary text-white px-6 py-3 rounded-lg hover:opacity-90 transition font-semibold flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Read Online
              </Link>
              <a
                href={pdfUrl}
                download
                className="border-2 border-primary text-primary px-6 py-3 rounded-lg hover:bg-primary hover:text-white transition font-semibold flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </a>
            </div>
          </div>

          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-green-900 mb-1">Your Story is Ready!</h3>
                <p className="text-sm text-green-800">
                  We've created a personalized {book.generated_story?.page_count || 15}-page storybook featuring {book.child_first_name}. Download the PDF below to read, print, or share!
                </p>
              </div>
            </div>
          </div>

          {/* PDF Preview */}
          <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
            <div className="bg-gray-100 border-b px-6 py-4">
              <h2 className="font-semibold text-lg">Book Preview</h2>
            </div>
            <div className="relative" style={{ minHeight: '800px' }}>
              {pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#view=FitH`}
                  className="w-full border-0"
                  style={{ height: '800px' }}
                  title="Book Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>PDF preview not available</p>
                </div>
              )}
            </div>
          </div>

          {/* Book Details */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-lg mb-4">Book Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pages:</span>
                  <span className="font-medium">{book.generated_story?.page_count || 15}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Style:</span>
                  <span className="font-medium">
                    {book.illustration_style.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">
                    {new Date(book.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">File Size:</span>
                  <span className="font-medium">
                    {book.generated_pdf.file_size_bytes
                      ? `${(book.generated_pdf.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-lg mb-4">What's Next?</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Read Online</p>
                    <p className="text-gray-600">Enjoy an interactive, slideshow-style reading experience perfect for tablets and computers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Print Your Book</p>
                    <p className="text-gray-600">Download the PDF and print at home or use a professional printing service.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Share with Family</p>
                    <p className="text-gray-600">Share the online reader link or email the PDF to grandparents, friends, and family.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Create Another Story</p>
                    <p className="text-gray-600">
                      <Link href="/create" className="text-primary hover:underline">
                        Make another personalized book
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Story Content (if available) */}
          {book.generated_story && (
            <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-lg mb-4">Story Preview</h3>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {book.generated_story.full_text?.substring(0, 500)}
                  {book.generated_story.full_text?.length > 500 && '...'}
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-4 italic">
                Download the full PDF to read the complete story!
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
