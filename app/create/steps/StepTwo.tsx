'use client';

import { useState } from 'react';
import { BookFormData } from '../CreateBookWizard';
import Image from 'next/image';

interface StepTwoProps {
  formData: BookFormData;
  updateFormData: (data: Partial<BookFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepTwo({ formData, updateFormData, onNext, onPrev }: StepTwoProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateFormData({ childPhoto: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const canProceed = formData.childFirstName && formData.childAge && formData.childPhoto;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Tell Us About Your Child</h2>

      <div className="space-y-6">
        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Child's Photo <span className="text-red-500">*</span>
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Upload a clear photo of your child's face for AI-generated character consistency
          </p>
          <div className="flex items-start gap-4">
            {photoPreview ? (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                <Image src={photoPreview} alt="Preview" fill className="object-cover" />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <span className="text-gray-400 text-sm">No photo</span>
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:opacity-90"
              />
              <p className="text-xs text-gray-500 mt-2">
                Accepted formats: JPG, PNG, WEBP (max 10MB)
              </p>
              <p className="text-xs text-red-500 mt-1">
                Photos are encrypted and automatically deleted after 24 hours
              </p>
            </div>
          </div>
        </div>

        {/* Child's Name */}
        <div>
          <label htmlFor="childName" className="block text-sm font-medium mb-2">
            Child's First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="childName"
            type="text"
            value={formData.childFirstName}
            onChange={(e) => updateFormData({ childFirstName: e.target.value })}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Emma"
          />
        </div>

        {/* Child's Age */}
        <div>
          <label htmlFor="childAge" className="block text-sm font-medium mb-2">
            Child's Age <span className="text-red-500">*</span>
          </label>
          <input
            id="childAge"
            type="number"
            min="1"
            max="14"
            value={formData.childAge || ''}
            onChange={(e) => {
              const age = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
              updateFormData({ childAge: age });
            }}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <p className="text-xs text-gray-500 mt-1">Ages 1-14 years</p>
        </div>

        {/* Child's Gender */}
        <div>
          <label htmlFor="childGender" className="block text-sm font-medium mb-2">
            Gender (Optional)
          </label>
          <select
            id="childGender"
            value={formData.childGender || ''}
            onChange={(e) => updateFormData({ childGender: e.target.value as any })}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
          </select>
        </div>

        {/* Hometown */}
        <div>
          <label htmlFor="hometown" className="block text-sm font-medium mb-2">
            Hometown / City (Optional)
          </label>
          <input
            id="hometown"
            type="text"
            value={formData.hometown || ''}
            onChange={(e) => updateFormData({ hometown: e.target.value })}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="e.g., London, New York, Sydney"
          />
          <p className="text-xs text-gray-500 mt-1">Helps personalize the story setting</p>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={onPrev}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
