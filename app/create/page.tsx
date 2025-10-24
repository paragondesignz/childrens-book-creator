'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CreatePage() {
  const [step, setStep] = useState(1);

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link href="/" className="text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>

          <h1 className="text-4xl font-bold mb-4">Create Your Personalized Story</h1>

          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-2 mx-1 rounded ${
                    s <= step ? 'bg-primary' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Template</span>
              <span>Child Info</span>
              <span>Pets</span>
              <span>Style</span>
              <span>Review</span>
            </div>
          </div>

          {/* Placeholder for the wizard */}
          <div className="border rounded-lg p-8 bg-white shadow-sm">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎨</div>
              <h2 className="text-2xl font-semibold mb-4">Book Creation Wizard</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                The interactive book creation wizard is coming soon! This will guide you through:
              </p>
              <ul className="text-left max-w-md mx-auto space-y-2 mb-8">
                <li className="flex items-start">
                  <span className="mr-2">1.</span>
                  <span>Choosing a story template or creating a custom story</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">2.</span>
                  <span>Adding your child's details and photo</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">3.</span>
                  <span>Including pets (optional)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">4.</span>
                  <span>Selecting an illustration style</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">5.</span>
                  <span>Reviewing and proceeding to payment</span>
                </li>
              </ul>

              <div className="space-y-4">
                <p className="font-semibold">Current Working Features:</p>
                <div className="flex gap-4 justify-center">
                  <Link
                    href="/templates"
                    className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
                  >
                    Browse Templates
                  </Link>
                  <Link
                    href="/"
                    className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Note */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold mb-2">For Developers:</h3>
            <p className="text-sm text-muted-foreground">
              The backend API is fully functional. You can test book creation via API:
            </p>
            <pre className="mt-2 p-3 bg-gray-900 text-white rounded text-xs overflow-x-auto">
{`POST /api/books
{
  "childFirstName": "Emma",
  "childAge": 6,
  "illustrationStyle": "watercolour",
  "templateId": "template-id-here"
}`}
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}
