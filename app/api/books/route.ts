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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('Auth check:', { user: user?.id, authError });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Authentication failed', details: authError.message }, { status: 401 });
    }

    if (!user) {
      console.error('No user found in session');
      return NextResponse.json({ error: 'Unauthorized - no user in session' }, { status: 401 });
    }

    const body = await req.json();
    console.log('Request body received:', { ...body, childFirstName: body.childFirstName, illustrationStyle: body.illustrationStyle });

    const validatedData = createBookSchema.parse(body);
    console.log('Data validated successfully');

    const insertData = {
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
    };

    console.log('Attempting to insert book order:', { user_id: user.id, has_template: !!validatedData.templateId });

    const { data: book, error } = await supabase
      .from('book_orders')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('Book created successfully:', book.id);
    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error creating book:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Internal server error',
      message: errorMessage,
      details: error
    }, { status: 500 });
  }
}
