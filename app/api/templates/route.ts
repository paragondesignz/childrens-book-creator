import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const minAge = searchParams.get('minAge');
    const maxAge = searchParams.get('maxAge');

    const where: any = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (minAge || maxAge) {
      where.AND = [];
      if (minAge) {
        where.AND.push({ minAge: { lte: parseInt(minAge) } });
      }
      if (maxAge) {
        where.AND.push({ maxAge: { gte: parseInt(maxAge) } });
      }
    }

    const templates = await db.storyTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
