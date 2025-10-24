'use client';

import { BookFormData } from '../CreateBookWizard';
import Image from 'next/image';
import { useState, useEffect } from 'react';

interface StepFiveProps {
  formData: BookFormData;
  templates: any[];
  onPrev: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function StepFive({ formData, templates, onPrev, onSubmit, loading }: StepFiveProps) {
  const [childPhotoPreview, setChildPhotoPreview] = useState<string | null>(null);
  const [petPhotoPreviews, setPetPhotoPreviews] = useState<{ [key: number]: string }>({});

  const selectedTemplate = templates.find((t) => t.id === formData.templateId);

  useEffect(() => {
    // Generate child photo preview
    if (formData.childPhoto) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChildPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(formData.childPhoto);
    }

    // Generate pet photo previews
    formData.pets.forEach((pet, index) => {
      if (pet.photo) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPetPhotoPreviews((prev) => ({ ...prev, [index]: reader.result as string }));
        };
        reader.readAsDataURL(pet.photo);
      }
    });
  }, [formData.childPhoto, formData.pets]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Review Your Story</h2>
      <p className="text-gray-600 mb-6">
        Please review all details before creating your personalized storybook
      </p>

      <div className="space-y-6">
        {/* Story Template */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-3">Story Template</h3>
          {selectedTemplate ? (
            <div>
              <p className="font-medium text-primary">{selectedTemplate.title}</p>
              <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 text-xs bg-white rounded-full border">
                  {selectedTemplate.category}
                </span>
                <span className="px-2 py-1 text-xs bg-white rounded-full border">
                  Ages {selectedTemplate.min_age}-{selectedTemplate.max_age}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-medium text-primary">Custom Story</p>
              <p className="text-sm text-gray-600 mt-2 italic">
                "{formData.customStoryPrompt}"
              </p>
            </div>
          )}
        </div>

        {/* Child Information */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-3">Child Information</h3>
          <div className="flex items-start gap-4">
            {childPhotoPreview && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                <Image src={childPhotoPreview} alt="Child" fill className="object-cover" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <p>
                <span className="font-medium">Name:</span> {formData.childFirstName}
              </p>
              <p>
                <span className="font-medium">Age:</span> {formData.childAge} years old
              </p>
              {formData.childGender && formData.childGender !== 'prefer-not-to-say' && (
                <p>
                  <span className="font-medium">Gender:</span>{' '}
                  {formData.childGender.charAt(0).toUpperCase() + formData.childGender.slice(1)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pets */}
        {formData.pets.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3">Pets</h3>
            <div className="space-y-4">
              {formData.pets.map((pet, index) => (
                <div key={index} className="flex items-start gap-4 bg-white rounded-lg p-4">
                  {petPhotoPreviews[index] && (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                      <Image
                        src={petPhotoPreviews[index]}
                        alt={pet.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{pet.name}</p>
                    <p className="text-sm text-gray-600">
                      {pet.type.charAt(0).toUpperCase() + pet.type.slice(1)}
                      {pet.breed && ` - ${pet.breed}`}
                    </p>
                    <p className="text-sm text-gray-600">Colour: {pet.colour}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customization */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Story Customization</h3>

          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">Illustration Style:</p>
              <span className="px-3 py-1 bg-primary text-white rounded-full text-sm">
                {formData.illustrationStyle
                  .split('-')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </span>
            </div>

            <div>
              <p className="font-medium mb-2">Favourite Colours:</p>
              <div className="flex flex-wrap gap-2">
                {formData.favouriteColours.map((color) => (
                  <span
                    key={color}
                    className="px-3 py-1 bg-white border rounded-full text-sm"
                  >
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">Interests:</p>
              <div className="flex flex-wrap gap-2">
                {formData.interests.map((interest) => (
                  <span
                    key={interest}
                    className="px-3 py-1 bg-white border rounded-full text-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">Personality Traits:</p>
              <div className="flex flex-wrap gap-2">
                {formData.personalityTraits.map((trait) => (
                  <span
                    key={trait}
                    className="px-3 py-1 bg-white border rounded-full text-sm"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Important Information</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>All uploaded photos are encrypted and stored securely</li>
            <li>Photos are automatically deleted after 24 hours for privacy</li>
            <li>Story generation typically takes 5-10 minutes</li>
            <li>You will receive an email when your book is ready</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={onPrev}
          disabled={loading}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="bg-primary text-white px-8 py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Creating Your Story...
            </>
          ) : (
            'Create My Storybook'
          )}
        </button>
      </div>
    </div>
  );
}
