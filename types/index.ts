export type IllustrationStyle =
  | 'watercolour'
  | 'digital-art'
  | 'cartoon'
  | 'storybook-classic'
  | 'modern-minimal'
  | 'photographic'
  | 'anime'
  | 'comic-book'
  | 'fantasy-realistic'
  | 'graphic-novel';

export type BookStatus =
  | 'draft'
  | 'processing'
  | 'generating-story'
  | 'generating-images'
  | 'creating-pdf'
  | 'content-review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ProductTier = 'digital-pdf' | 'printed-softcover' | 'printed-hardcover';

export interface ChildInformation {
  firstName: string;
  age: number;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  favouriteColours: string[];
  interests: string[];
  personalityTraits: string[];
  photoUrl: string;
}

export interface PetInformation {
  name: string;
  type: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
  breed?: string;
  colour: string;
  photoUrl?: string;
}

export interface BookConfiguration {
  templateId?: string;
  childInfo: ChildInformation;
  petInfo?: PetInformation[];
  customStoryPrompt?: string;
  selectedStyle: IllustrationStyle;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
}

export interface GeneratedStoryData {
  title: string;
  pages: StoryPage[];
}

export interface ModerationResult {
  passed: boolean;
  flags: {
    inappropriate?: boolean;
    violent?: boolean;
    adult?: boolean;
    discriminatory?: boolean;
  };
  confidence: number;
  reviewRequired: boolean;
}
