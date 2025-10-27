'use client';

import { BookFormData } from '../CreateBookWizard';

interface StepFourProps {
  formData: BookFormData;
  updateFormData: (data: Partial<BookFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const COLORS = [
  { value: 'red', label: 'Red', color: 'bg-red-500' },
  { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
  { value: 'green', label: 'Green', color: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow', color: 'bg-yellow-400' },
  { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', color: 'bg-pink-400' },
  { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
  { value: 'teal', label: 'Teal', color: 'bg-teal-500' },
];

const INTERESTS = [
  'Animals', 'Space', 'Dinosaurs', 'Pirates', 'Princesses', 'Dragons',
  'Sports', 'Music', 'Art', 'Science', 'Nature', 'Magic',
  'Vehicles', 'Superheroes', 'Cooking', 'Adventure'
];

const PERSONALITY_TRAITS = [
  'Brave', 'Kind', 'Curious', 'Funny', 'Creative', 'Smart',
  'Adventurous', 'Caring', 'Energetic', 'Thoughtful', 'Confident', 'Gentle'
];

const FAVOURITE_FOODS = [
  'Pizza', 'Ice Cream', 'Pasta', 'Burgers', 'Chocolate', 'Cake',
  'Fruit', 'Vegetables', 'Cookies', 'Chicken', 'Fish', 'Rice',
  'Sandwiches', 'Pancakes', 'Tacos', 'Sushi'
];

const ILLUSTRATION_STYLES = [
  {
    value: 'watercolour',
    label: 'Watercolour',
    description: 'Soft, dreamy illustrations with gentle colors',
    ageRange: '3-10',
  },
  {
    value: 'digital-art',
    label: 'Digital Art',
    description: 'Modern, vibrant digital illustrations',
    ageRange: '4-12',
  },
  {
    value: 'cartoon',
    label: 'Cartoon',
    description: 'Fun, playful cartoon-style drawings',
    ageRange: '3-10',
  },
  {
    value: 'storybook-classic',
    label: 'Classic Storybook',
    description: 'Traditional storybook illustration style',
    ageRange: '3-10',
  },
  {
    value: 'modern-minimal',
    label: 'Modern Minimal',
    description: 'Clean, simple, contemporary illustrations',
    ageRange: '5-14',
  },
  {
    value: 'photographic',
    label: 'Photographic',
    description: 'Realistic, photo-like illustrations',
    ageRange: '8-14',
  },
  {
    value: 'anime',
    label: 'Anime',
    description: 'Japanese anime-inspired character art',
    ageRange: '8-14',
  },
  {
    value: 'comic-book',
    label: 'Comic Book',
    description: 'Dynamic comic book style with bold colors',
    ageRange: '7-14',
  },
  {
    value: 'fantasy-realistic',
    label: 'Fantasy Realistic',
    description: 'Detailed fantasy art with realistic elements',
    ageRange: '9-14',
  },
  {
    value: 'graphic-novel',
    label: 'Graphic Novel',
    description: 'Mature, sophisticated graphic novel style',
    ageRange: '10-14',
  },
];

export function StepFour({ formData, updateFormData, onNext, onPrev }: StepFourProps) {
  const toggleArrayItem = (array: string[], item: string) => {
    if (array.includes(item)) {
      return array.filter((i) => i !== item);
    } else {
      return [...array, item];
    }
  };

  // All fields are optional - user can proceed with any selections
  const canProceed = true;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Customize Your Story</h2>
      <p className="text-gray-600 mb-6">
        Help us personalize the story by selecting your child's preferences (all optional)
      </p>

      <div className="space-y-8">
        {/* Illustration Style */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Illustration Style
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            {ILLUSTRATION_STYLES.map((style) => (
              <div
                key={style.value}
                onClick={() => updateFormData({ illustrationStyle: style.value as any })}
                className={`border rounded-lg p-4 cursor-pointer transition ${
                  formData.illustrationStyle === style.value
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{style.label}</h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        Ages {style.ageRange}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{style.description}</p>
                  </div>
                  {formData.illustrationStyle === style.value && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Favourite Colours */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Favourite Colours (Optional)
          </label>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() =>
                  updateFormData({
                    favouriteColours: toggleArrayItem(formData.favouriteColours, color.value),
                  })
                }
                className={`relative flex flex-col items-center gap-2 p-3 border rounded-lg transition ${
                  formData.favouriteColours.includes(color.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${color.color}`} />
                <span className="text-xs font-medium">{color.label}</span>
                {formData.favouriteColours.includes(color.value) && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Interests & Hobbies (Optional)
            <span className="text-xs text-gray-500 ml-2">(Select up to 5)</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {INTERESTS.map((interest) => (
              <button
                key={interest}
                onClick={() =>
                  updateFormData({
                    interests: toggleArrayItem(formData.interests, interest),
                  })
                }
                disabled={
                  !formData.interests.includes(interest) && formData.interests.length >= 5
                }
                className={`p-3 border rounded-lg text-sm font-medium transition ${
                  formData.interests.includes(interest)
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        {/* Personality Traits */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Personality Traits (Optional)
            <span className="text-xs text-gray-500 ml-2">(Select up to 4)</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PERSONALITY_TRAITS.map((trait) => (
              <button
                key={trait}
                onClick={() =>
                  updateFormData({
                    personalityTraits: toggleArrayItem(formData.personalityTraits, trait),
                  })
                }
                disabled={
                  !formData.personalityTraits.includes(trait) &&
                  formData.personalityTraits.length >= 4
                }
                className={`p-3 border rounded-lg text-sm font-medium transition ${
                  formData.personalityTraits.includes(trait)
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {trait}
              </button>
            ))}
          </div>
        </div>

        {/* Favourite Foods */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Favourite Foods (Optional)
            <span className="text-xs text-gray-500 ml-2">(Select up to 5)</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {FAVOURITE_FOODS.map((food) => (
              <button
                key={food}
                onClick={() =>
                  updateFormData({
                    favouriteFoods: toggleArrayItem(formData.favouriteFoods, food),
                  })
                }
                disabled={
                  !formData.favouriteFoods.includes(food) && formData.favouriteFoods.length >= 5
                }
                className={`p-3 border rounded-lg text-sm font-medium transition ${
                  formData.favouriteFoods.includes(food)
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {food}
              </button>
            ))}
          </div>
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
