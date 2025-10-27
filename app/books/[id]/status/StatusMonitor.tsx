'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

interface StatusMonitorProps {
  bookId: string;
  initialStatus: string;
}

interface GeneratedImage {
  id: string;
  page_number: number;
  image_url: string;
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
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  useEffect(() => {
    const supabase = createClient();

    // Fetch existing images on mount
    const fetchExistingImages = async () => {
      const { data } = await supabase
        .from('generated_images')
        .select('id, page_number, image_url')
        .eq('book_order_id', bookId)
        .order('page_number', { ascending: true });

      if (data) {
        setGeneratedImages(data);
      }
    };

    fetchExistingImages();

    // Set up real-time subscription for book status
    const bookChannel = supabase
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

    // Set up real-time subscription for generated images
    const imagesChannel = supabase
      .channel(`images-${bookId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'generated_images',
          filter: `book_order_id=eq.${bookId}`,
        },
        (payload) => {
          const newImage = payload.new as GeneratedImage;
          setGeneratedImages((prev) => {
            // Check if image already exists
            if (prev.some((img) => img.id === newImage.id)) {
              return prev;
            }
            // Add new image and sort by page number
            return [...prev, newImage].sort((a, b) => a.page_number - b.page_number);
          });
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

      // Also poll for new images
      const { data: images } = await supabase
        .from('generated_images')
        .select('id, page_number, image_url')
        .eq('book_order_id', bookId)
        .order('page_number', { ascending: true });

      if (images) {
        setGeneratedImages(images);
      }
    }, 5000);

    return () => {
      bookChannel.unsubscribe();
      imagesChannel.unsubscribe();
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

      {/* Generated Images Preview */}
      {generatedImages.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Illustrations ({generatedImages.length} of 8)
            </h3>
            {generatedImages.length < 8 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span>Generating...</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {generatedImages.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100 animate-fadeIn"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <Image
                  src={image.image_url}
                  alt={`Page ${image.page_number}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                  <span className="text-white text-xs font-medium">
                    Page {image.page_number}
                  </span>
                </div>
              </div>
            ))}
            {/* Placeholder for remaining images */}
            {Array.from({ length: 8 - generatedImages.length }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className="relative aspect-square rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center"
              >
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-400">{generatedImages.length + i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
