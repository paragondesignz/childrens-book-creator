import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DigitalBookViewer } from '@/app/components/DigitalBookViewer';

export default async function DigitalReadPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch book order with all related data
  const { data: book, error } = await supabase
    .from('book_orders')
    .select(`
      *,
      template:story_templates(*),
      generated_story:generated_stories(
        *,
        pages:story_pages(*)
      )
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !book) {
    redirect('/dashboard');
  }

  // If not completed, redirect to status page
  if (book.status !== 'completed' || !book.generated_story) {
    redirect(`/books/${book.id}/status`);
  }

  // Fetch generated images (covers + story pages)
  const { data: generatedImages } = await supabase
    .from('generated_images')
    .select('*')
    .eq('book_order_id', book.id)
    .order('page_number', { ascending: true });

  // Build pages array for viewer
  // Format: [front cover, text page 1, image page 1, text page 2, image page 2, ..., back cover]
  const pages: any[] = [];

  // Front cover (page_number = 0)
  const frontCover = generatedImages?.find(img => img.page_number === 0);
  if (frontCover) {
    pages.push({
      pageNumber: 0,
      pageText: null,
      imageUrl: frontCover.image_url,
      type: 'cover',
    });
  }

  // Story pages - alternating text and image
  const storyPages = book.generated_story.pages || [];
  storyPages.sort((a: any, b: any) => a.page_number - b.page_number);

  for (const storyPage of storyPages) {
    // Text page
    pages.push({
      pageNumber: storyPage.page_number,
      pageText: storyPage.page_text,
      imageUrl: null,
      type: 'text',
    });

    // Image page
    const image = generatedImages?.find(img => img.page_number === storyPage.page_number);
    if (image) {
      pages.push({
        pageNumber: storyPage.page_number,
        pageText: null,
        imageUrl: image.image_url,
        type: 'image',
      });
    }
  }

  // Back cover (page_number = 16)
  const backCover = generatedImages?.find(img => img.page_number === 16);
  if (backCover) {
    pages.push({
      pageNumber: 16,
      pageText: null,
      imageUrl: backCover.image_url,
      type: 'cover',
    });
  }

  return (
    <main className="min-h-screen">
      <DigitalBookViewer
        title={book.generated_story.title || `${book.child_first_name}'s Story`}
        childName={book.child_first_name}
        pages={pages}
      />
    </main>
  );
}
