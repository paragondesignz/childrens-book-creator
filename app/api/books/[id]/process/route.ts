import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { addBookProcessingJob } from '@/lib/queue';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const book = await db.bookOrder.findUnique({
      where: { id: params.id },
      include: {
        payments: true,
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    if (book.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if payment is completed
    const paidPayment = book.payments.find((p) => p.status === 'completed');
    if (!paidPayment) {
      return NextResponse.json({ error: 'Payment required' }, { status: 402 });
    }

    // Check if already processing or completed
    if (book.status !== 'draft') {
      return NextResponse.json({ error: 'Book already processing or completed' }, { status: 400 });
    }

    // Update status and add to queue
    await db.bookOrder.update({
      where: { id: params.id },
      data: { status: 'processing' },
    });

    await addBookProcessingJob(params.id);

    return NextResponse.json({ success: true, message: 'Book processing started' });
  } catch (error) {
    console.error('Error starting book processing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
