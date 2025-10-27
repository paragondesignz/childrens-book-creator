'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StepOne } from './steps/StepOne';
import { StepTwo } from './steps/StepTwo';
import { StepThree } from './steps/StepThree';
import { StepFour } from './steps/StepFour';
import { StepFive } from './steps/StepFive';

export interface BookFormData {
  templateId?: string;
  childFirstName: string;
  childAge: number;
  childGender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  hometown?: string;
  childPhoto?: File;
  childPhotoUrl?: string;
  pets: Array<{
    name: string;
    type: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
    breed?: string;
    colour: string;
    photo?: File;
    photoUrl?: string;
  }>;
  favouriteColours: string[];
  favouriteFoods: string[];
  interests: string[];
  personalityTraits: string[];
  illustrationStyle: 'watercolour' | 'digital-art' | 'cartoon' | 'storybook-classic' | 'modern-minimal';
  customStoryPrompt?: string;
}

interface CreateBookWizardProps {
  templates: any[];
}

export function CreateBookWizard({ templates }: CreateBookWizardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<BookFormData>({
    childFirstName: '',
    childAge: 5,
    pets: [],
    favouriteColours: [],
    favouriteFoods: [],
    interests: [],
    personalityTraits: [],
    illustrationStyle: 'watercolour',
  });

  const totalSteps = 5;

  const updateFormData = (data: Partial<BookFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Upload child photo to Supabase Storage
      let childPhotoUrl = '';
      if (formData.childPhoto) {
        const fileExt = formData.childPhoto.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('temp-uploads')
          .upload(fileName, formData.childPhoto, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('temp-uploads')
          .getPublicUrl(fileName);

        childPhotoUrl = publicUrl;
      }

      // Upload pet photos
      const petsWithUrls = await Promise.all(
        formData.pets.map(async (pet) => {
          if (pet.photo) {
            const fileExt = pet.photo.name.split('.').pop();
            const fileName = `${user.id}/pets/${Date.now()}-${pet.name}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('temp-uploads')
              .upload(fileName, pet.photo, {
                cacheControl: '3600',
                upsert: false,
              });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('temp-uploads')
              .getPublicUrl(fileName);

            return { ...pet, photoUrl: publicUrl };
          }
          return pet;
        })
      );

      // Create book order via API
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: formData.templateId,
          childFirstName: formData.childFirstName,
          childAge: formData.childAge,
          childGender: formData.childGender,
          favouriteColours: formData.favouriteColours,
          interests: formData.interests,
          personalityTraits: formData.personalityTraits,
          customStoryPrompt: formData.customStoryPrompt,
          illustrationStyle: formData.illustrationStyle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create book');
      }

      const { book } = await response.json();

      // Save uploaded image records
      if (childPhotoUrl) {
        await supabase.from('uploaded_images').insert({
          book_order_id: book.id,
          image_type: 'child_photo', // CRITICAL: Must match query in imageGeneration.service.ts
          storage_url: childPhotoUrl,
          encrypted_url: childPhotoUrl,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Save pets
      for (const pet of petsWithUrls) {
        await supabase.from('book_pets').insert({
          book_order_id: book.id,
          pet_name: pet.name,
          pet_type: pet.type,
          breed: pet.breed,
          colour: pet.colour,
        });

        if (pet.photoUrl) {
          await supabase.from('uploaded_images').insert({
            book_order_id: book.id,
            image_type: 'pet',
            storage_url: pet.photoUrl,
            encrypted_url: pet.photoUrl,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // Redirect to checkout
      router.push(`/books/${book.id}/checkout`);
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to create book');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-2 mx-1 rounded transition-all ${
                index + 1 <= currentStep ? 'bg-primary' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Template</span>
          <span>Child Info</span>
          <span>Pets</span>
          <span>Customize</span>
          <span>Review</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border p-8">
        {currentStep === 1 && (
          <StepOne
            templates={templates}
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
          />
        )}
        {currentStep === 2 && (
          <StepTwo
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {currentStep === 3 && (
          <StepThree
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {currentStep === 4 && (
          <StepFour
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {currentStep === 5 && (
          <StepFive
            formData={formData}
            templates={templates}
            onPrev={prevStep}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
