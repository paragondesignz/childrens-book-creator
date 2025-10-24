import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const books = await db.bookOrder.findMany({
      where: { userId: session.user.id },
      include: {
        template: true,
        generatedStory: true,
        generatedPdf: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ books });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createBookSchema.parse(body);

    const book = await db.bookOrder.create({
      data: {
        userId: session.user.id,
        templateId: validatedData.templateId,
        childFirstName: validatedData.childFirstName,
        childAge: validatedData.childAge,
        childGender: validatedData.childGender,
        favouriteColours: validatedData.favouriteColours as any,
        interests: validatedData.interests as any,
        personalityTraits: validatedData.personalityTraits as any,
        customStoryPrompt: validatedData.customStoryPrompt,
        illustrationStyle: validatedData.illustrationStyle,
        status: 'draft',
      },
    });

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error creating book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
