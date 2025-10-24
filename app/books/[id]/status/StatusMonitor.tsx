'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface StatusMonitorProps {
  bookId: string;
  initialStatus: string;
}

const STATUS_STEPS = [
  { key: 'processing', label: 'Processing Order', order: 1 },
  { key: 'generating-story', label: 'Generating Story', order: 2 },
  { key: 'generating-images', label: 'Creating Illustrations', order: 3 },
  { key: 'creating-pdf', label: 'Assembling PDF', order: 4 },
  { key: 'completed', label: 'Complete', order: 5 },
];

export function StatusMonitor({ bookId, initialStatus }: StatusMonitorProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Set up real-time subscription
    const channel = supabase
      .channel(`book-${bookId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'book_orders',
          filter: `id=eq.${bookId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          setStatus(newStatus);

          if (newStatus === 'completed') {
            // Small delay before redirect to show completion state
            setTimeout(() => {
              router.push(`/books/${bookId}/preview`);
            }, 2000);
          } else if (newStatus === 'failed') {
            setError('Book generation failed. Please contact support.');
          }
        }
      )
      .subscribe();

    // Fallback: Poll every 5 seconds if realtime doesn't work
    const pollInterval = setInterval(async () => {
      const { data: book } = await supabase
        .from('book_orders')
        .select('status')
        .eq('id', bookId)
        .single();

      if (book) {
        setStatus(book.status);

        if (book.status === 'completed') {
          setTimeout(() => {
            router.push(`/books/${bookId}/preview`);
          }, 2000);
          clearInterval(pollInterval);
        } else if (book.status === 'failed') {
          setError('Book generation failed. Please contact support.');
          clearInterval(pollInterval);
        }
      }
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [bookId, router]);

  const currentStep = STATUS_STEPS.find((step) => step.key === status);
  const currentOrder = currentStep?.order || 1;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Generation Failed</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-8">
      <div className="space-y-6">
        {STATUS_STEPS.map((step) => {
          const isCompleted = step.order < currentOrder;
          const isCurrent = step.order === currentOrder;
          const isPending = step.order > currentOrder;

          return (
            <div key={step.key} className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? 'bg-green-500'
                    : isCurrent
                    ? 'bg-primary'
                    : 'bg-gray-200'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-gray-500 font-semibold">{step.order}</span>
                )}
              </div>
              <div className="flex-1">
                <h3
                  className={`font-semibold ${
                    isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </h3>
                {isCurrent && (
                  <p className="text-sm text-primary mt-1">In progress...</p>
                )}
                {isCompleted && (
                  <p className="text-sm text-green-600 mt-1">Completed</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status === 'completed' && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-green-900">Your book is ready!</p>
              <p className="text-sm text-green-800">Redirecting to preview...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
