'use client';

import { BookFormData } from '../CreateBookWizard';

interface StepOneProps {
  templates: any[];
  formData: BookFormData;
  updateFormData: (data: Partial<BookFormData>) => void;
  onNext: () => void;
}

export function StepOne({ templates, formData, updateFormData, onNext }: StepOneProps) {
  const handleNext = () => {
    if (formData.templateId || formData.customStoryPrompt) {
      onNext();
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Choose Your Story Template</h2>
      <p className="text-gray-600 text-sm mb-4">
        Select a pre-made story template or create your own custom story below
      </p>

      {/* Scrollable template list */}
      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4 mb-6 border rounded-lg p-4 bg-gray-50">
        {templates.map((template) => (
          <div
            key={template.id}
            onClick={() => updateFormData({ templateId: template.id, customStoryPrompt: undefined })}
            className={`border rounded-lg p-4 cursor-pointer transition bg-white ${
              formData.templateId === template.id
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-primary/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{template.title}</h3>
                  <span className="px-2 py-1 text-xs bg-gray-100 rounded-full">
                    {template.category}
                  </span>
                  <span className="text-sm text-gray-500">
                    Ages {template.min_age}-{template.max_age}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{template.description}</p>
              </div>
              {formData.templateId === template.id && (
                <div className="ml-4">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-6 mb-6">
        <button
          onClick={() => updateFormData({ templateId: undefined })}
          className={`w-full text-left border rounded-lg p-4 cursor-pointer transition ${
            !formData.templateId
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-primary/50'
          }`}
        >
          <h3 className="font-semibold text-lg mb-2">Custom Story</h3>
          <p className="text-gray-600 text-sm mb-3">
            Have a unique idea? Describe your own custom story!
          </p>
          {!formData.templateId && (
            <textarea
              value={formData.customStoryPrompt || ''}
              onChange={(e) => updateFormData({ customStoryPrompt: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
              placeholder="Describe your story idea... (e.g., 'A story about a child who discovers they can talk to animals and goes on an adventure to save the forest')"
            />
          )}
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!formData.templateId && !formData.customStoryPrompt}
          className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
