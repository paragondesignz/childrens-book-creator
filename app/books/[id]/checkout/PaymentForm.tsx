'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentForm({ bookId }: { bookId: string }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/books/${bookId}/mock-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment processing failed');
      }

      // Redirect to the status page
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        router.push(`/books/${bookId}/status`);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment processing failed');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full bg-primary text-white px-6 py-3 rounded-lg hover:opacity-90 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Continue to Processing (Test Mode)'}
      </button>
    </form>
  );
}
