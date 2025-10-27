import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreateBookWizard } from './CreateBookWizard';
import Link from 'next/link';

export default async function CreatePage({
  searchParams,
}: {
  searchParams: { template?: string };
}) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch active templates
  const { data: templates, error } = await supabase
    .from('story_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
  }

  // Get pre-selected template from query params
  const selectedTemplateId = searchParams.template;

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
        <div className="mb-8">
          <Link href="/dashboard" className="text-primary hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8">Create Your Personalized Story</h1>

        <CreateBookWizard
          templates={templates || []}
          initialTemplateId={selectedTemplateId}
        />
      </div>
    </main>
  );
}
