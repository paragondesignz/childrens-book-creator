import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function TemplatesPage() {
  const supabase = createClient();

  const { data: templates } = await supabase
    .from('story_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Story Templates</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Choose from our collection of magical story templates
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates?.map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 text-sm bg-primary/10 text-primary rounded-full mb-2">
                    {template.category}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    Ages {template.min_age}-{template.max_age}
                  </span>
                </div>

                <h3 className="text-xl font-semibold mb-2">{template.title}</h3>
                <p className="text-muted-foreground mb-4 line-clamp-3">
                  {template.description}
                </p>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <span>{template.page_count} pages</span>
                  {template.includes_pets && <span>• Can include pets</span>}
                </div>

                <Link
                  href={`/create?template=${template.id}`}
                  className="inline-block w-full text-center bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
                >
                  Use This Template
                </Link>
              </div>
            ))}
          </div>

          {(!templates || templates.length === 0) && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No templates available yet.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
