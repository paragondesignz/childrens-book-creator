'use client';

import { useState } from 'react';
import { BookFormData } from '../CreateBookWizard';
import Image from 'next/image';

interface StepThreeProps {
  formData: BookFormData;
  updateFormData: (data: Partial<BookFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepThree({ formData, updateFormData, onNext, onPrev }: StepThreeProps) {
  const [petPreviews, setPetPreviews] = useState<{ [key: number]: string }>({});

  const addPet = () => {
    const newPets = [
      ...formData.pets,
      {
        name: '',
        type: 'dog' as const,
        breed: '',
        colour: '',
      },
    ];
    updateFormData({ pets: newPets });
  };

  const removePet = (index: number) => {
    const newPets = formData.pets.filter((_, i) => i !== index);
    const newPreviews = { ...petPreviews };
    delete newPreviews[index];
    setPetPreviews(newPreviews);
    updateFormData({ pets: newPets });
  };

  const updatePet = (index: number, field: string, value: any) => {
    const newPets = [...formData.pets];
    newPets[index] = { ...newPets[index], [field]: value };
    updateFormData({ pets: newPets });
  };

  const handlePetPhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updatePet(index, 'photo', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPetPreviews((prev) => ({ ...prev, [index]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Add Your Child's Pets (Optional)</h2>
      <p className="text-gray-600 mb-6">
        Include beloved pets in the story to make it even more special! You can skip this step if you prefer.
      </p>

      <div className="space-y-6">
        {formData.pets.map((pet, index) => (
          <div key={index} className="border rounded-lg p-6 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Pet {index + 1}</h3>
              <button
                onClick={() => removePet(index)}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Pet Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Pet's Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pet.name}
                  onChange={(e) => updatePet(index, 'name', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Max"
                />
              </div>

              {/* Pet Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Pet Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={pet.type}
                  onChange={(e) => updatePet(index, 'type', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="rabbit">Rabbit</option>
                  <option value="bird">Bird</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Breed */}
              <div>
                <label className="block text-sm font-medium mb-2">Breed (Optional)</label>
                <input
                  type="text"
                  value={pet.breed || ''}
                  onChange={(e) => updatePet(index, 'breed', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Golden Retriever"
                />
              </div>

              {/* Colour */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Colour <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pet.colour}
                  onChange={(e) => updatePet(index, 'colour', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Golden brown"
                />
              </div>
            </div>

            {/* Pet Photo */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Pet's Photo (Optional)</label>
              <p className="text-sm text-gray-600 mb-3">
                Upload a photo to help AI create a more accurate representation
              </p>
              <div className="flex items-start gap-4">
                {petPreviews[index] ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                    <Image src={petPreviews[index]} alt="Pet preview" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                    <span className="text-gray-400 text-sm">No photo</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handlePetPhotoChange(index, e)}
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
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Pet Button */}
        {formData.pets.length < 3 && (
          <button
            onClick={addPet}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-gray-600 hover:border-primary hover:text-primary transition"
          >
            <span className="text-2xl mb-2 block">+</span>
            Add a Pet
          </button>
        )}

        {formData.pets.length >= 3 && (
          <p className="text-sm text-gray-500 text-center">
            Maximum of 3 pets can be added to keep the story focused.
          </p>
        )}
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
          disabled={formData.pets.some((pet) => !pet.name || !pet.colour)}
          className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
