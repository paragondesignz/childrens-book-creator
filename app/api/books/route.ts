import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createBookSchema = z.object({
  templateId: z.string().optional(),
  childFirstName: z.string().min(1).max(100),
  childAge: z.number().int().min(1).max(12),
  childGender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).optional(),
  favouriteColours: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  personalityTraits: z.array(z.string()).optional(),
  customStoryPrompt: z.string().optional(),
  illustrationStyle: z.enum(['watercolour', 'digital-art', 'cartoon', 'storybook-classic', 'modern-minimal']),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: books, error } = await supabase
      .from('book_orders')
      .select(`
        *,
        template:story_templates(*),
        generated_story:generated_stories(*),
        generated_pdf:generated_pdfs(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ books });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createBookSchema.parse(body);

    const { data: book, error } = await supabase
      .from('book_orders')
      .insert({
        user_id: user.id,
        template_id: validatedData.templateId,
        child_first_name: validatedData.childFirstName,
        child_age: validatedData.childAge,
        child_gender: validatedData.childGender,
        favourite_colours: validatedData.favouriteColours,
        interests: validatedData.interests,
        personality_traits: validatedData.personalityTraits,
        custom_story_prompt: validatedData.customStoryPrompt,
        illustration_style: validatedData.illustrationStyle,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error creating book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
