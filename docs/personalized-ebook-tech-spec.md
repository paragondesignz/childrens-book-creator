# Personalized Children's E-Book Web Application
## Technical Specification Document

**Version:** 1.0  
**Date:** 24 October 2025  
**Project:** AI-Generated Personalized Children's Storybooks

---

## 1. Executive Summary

A web-based application that allows parents to create personalized illustrated storybooks featuring their child as the hero. The system uses Google Gemini 2.5 Flash for image generation and Google Gemini 2.0 Flash for story text generation, producing 15-page illustrated e-books available as digital PDFs or physical printed books via print-on-demand services.

**Core Value Proposition:**
- Personalised stories featuring the user's child
- AI-generated custom illustrations maintaining character consistency
- Multiple story templates and custom story options
- Inclusion of pets and personal interests
- Professional-quality PDF output
- Optional physical book printing and delivery

---

## 2. Technical Architecture

### 2.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  Next.js 14+ (React) + TypeScript + Tailwind CSS           │
│  - User Interface Components                                 │
│  - Image Upload & Preview                                    │
│  - Form Wizard (Multi-step)                                  │
│  - PDF Preview                                               │
│  - Payment Integration                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│  Next.js API Routes / Express.js Backend                    │
│  - Authentication & Authorization                            │
│  - Request Validation                                        │
│  - Rate Limiting                                             │
│  - Error Handling                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Services                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Story      │  │   Image      │  │     PDF      │     │
│  │  Generation  │  │  Generation  │  │  Generation  │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Content    │  │   Payment    │  │  Print-on-   │     │
│  │  Moderation  │  │  Processing  │  │    Demand    │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data & Storage Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL  │  │   Redis      │  │  Temporary   │     │
│  │   Database   │  │    Cache     │  │    Object    │     │
│  │              │  │   & Queue    │  │   Storage    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    External Services Layer                   │
│  - Google Gemini 2.5 Flash (Images)                         │
│  - Google Gemini 2.0 Flash (Text)                           │
│  - Stripe Payment Gateway                                    │
│  - Print-on-Demand API (Lulu/Printful)                      │
│  - AWS S3 / Google Cloud Storage                            │
│  - SendGrid (Email notifications)                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

**Frontend:**
- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- UI Library: React 18+
- Styling: Tailwind CSS
- Form Management: React Hook Form
- State Management: Zustand or React Context
- File Upload: react-dropzone
- PDF Preview: react-pdf
- Image Processing: sharp (server-side)

**Backend:**
- Runtime: Node.js 20+
- Framework: Next.js API Routes or Express.js
- Language: TypeScript
- Queue Management: Bull/BullMQ with Redis
- PDF Generation: PDFKit or Puppeteer
- Image Processing: Sharp
- Validation: Zod

**Database & Storage:**
- Primary Database: PostgreSQL 15+
- ORM: Prisma
- Cache/Queue: Redis 7+
- Temporary Storage: AWS S3 or Google Cloud Storage (with 24-hour auto-deletion)
- CDN: CloudFront or Cloudflare

**Infrastructure:**
- Hosting: Vercel (frontend) + AWS/Google Cloud (backend workers)
- Container Orchestration: Docker
- CI/CD: GitHub Actions
- Monitoring: Sentry (errors) + DataDog/New Relic (performance)
- Logging: Winston + CloudWatch/Google Cloud Logging

**External Services:**
- AI Generation: Google Gemini API (2.5 Flash for images, 2.0 Flash for text)
- Payment: Stripe
- Email: SendGrid
- Print-on-Demand: Lulu API or Printful API
- Analytics: Google Analytics 4 + Mixpanel

---

## 3. Core System Components

### 3.1 User Authentication System

**Requirements:**
- Email/password authentication
- Social login (Google, Facebook optional)
- Email verification required
- Parental age verification (18+)
- Session management with JWT
- Password reset functionality
- Multi-factor authentication (optional premium feature)

**Implementation:**
- NextAuth.js for authentication
- Bcrypt for password hashing
- JWT tokens with 7-day expiry
- Secure HTTP-only cookies

**Database Schema:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  date_of_birth DATE NOT NULL,
  age_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Story Configuration System

**Story Template Structure:**
```typescript
interface StoryTemplate {
  id: string;
  title: string;
  description: string;
  ageRange: {
    min: number;
    max: number;
  };
  category: 'adventure' | 'learning' | 'fantasy' | 'animals' | 'space' | 'custom';
  pageCount: number; // Fixed at 15 for initial version
  promptTemplate: string; // Base prompt for Gemini
  imageStyleGuide: string; // Consistent style instructions
  includesPets: boolean;
  includesInterests: boolean;
}

interface BookConfiguration {
  id: string;
  userId: string;
  templateId: string;
  childInfo: ChildInformation;
  petInfo?: PetInformation[];
  customStoryPrompt?: string;
  selectedStyle: IllustrationStyle;
  status: BookStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface ChildInformation {
  firstName: string;
  age: number;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  favouriteColours: string[];
  interests: string[];
  personalityTraits: string[];
  photoUrl: string; // Temporary storage URL
  photoEmbedding?: number[]; // For character consistency
}

interface PetInformation {
  name: string;
  type: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
  breed?: string;
  colour: string;
  photoUrl: string;
}

type IllustrationStyle = 
  | 'watercolour'
  | 'digital-art'
  | 'cartoon'
  | 'storybook-classic'
  | 'modern-minimal';

type BookStatus = 
  | 'draft'
  | 'processing'
  | 'generating-story'
  | 'generating-images'
  | 'creating-pdf'
  | 'content-review'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

**Database Schema:**
```sql
CREATE TABLE story_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  min_age INTEGER NOT NULL,
  max_age INTEGER NOT NULL,
  page_count INTEGER DEFAULT 15,
  prompt_template TEXT NOT NULL,
  image_style_guide TEXT NOT NULL,
  includes_pets BOOLEAN DEFAULT FALSE,
  includes_interests BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE book_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES story_templates(id),
  child_first_name VARCHAR(100) NOT NULL,
  child_age INTEGER NOT NULL,
  child_gender VARCHAR(50),
  favourite_colours JSONB,
  interests JSONB,
  personality_traits JSONB,
  custom_story_prompt TEXT,
  illustration_style VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE book_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  pet_name VARCHAR(100) NOT NULL,
  pet_type VARCHAR(50) NOT NULL,
  breed VARCHAR(100),
  colour VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE uploaded_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  image_type VARCHAR(50) NOT NULL, -- 'child' or 'pet'
  original_filename VARCHAR(255),
  storage_url VARCHAR(512) NOT NULL,
  encrypted_url VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP NOT NULL, -- Auto-delete after 24 hours
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

### 3.3 Story Generation Service

**Gemini Integration for Text Generation:**

**Process Flow:**
1. Receive book configuration
2. Build comprehensive prompt from template
3. Call Gemini 2.0 Flash with structured output
4. Parse and validate response
5. Run content moderation
6. Store approved story text

**Prompt Engineering:**
```typescript
interface StoryPromptBuilder {
  buildPrompt(config: BookConfiguration, template: StoryTemplate): string;
  
  // Example prompt structure:
  // "Write a 15-page children's story for [NAME], a [AGE]-year-old child.
  // 
  // Story Template: [TEMPLATE]
  // Child's Interests: [INTERESTS]
  // Child's Personality: [TRAITS]
  // Favourite Colours: [COLOURS]
  // [Include pet: [PET_NAME], a [COLOUR] [TYPE]]
  //
  // Requirements:
  // - Age-appropriate language for [AGE]-year-olds
  // - Positive, encouraging themes
  // - [NAME] should be the protagonist
  // - Story should be exactly 15 pages
  // - Each page should have 50-100 words
  // - Include engaging dialogue
  // - Educational elements appropriate for age
  // - Safe, positive resolution
  //
  // Return as JSON with structure:
  // {
  //   title: string,
  //   pages: [
  //     {
  //       pageNumber: number,
  //       text: string,
  //       imagePrompt: string // Description for illustration
  //     }
  //   ]
  // }"
}
```

**API Configuration:**
```typescript
const geminiTextConfig = {
  model: 'gemini-2.0-flash',
  temperature: 0.8, // Creative but consistent
  maxOutputTokens: 4096,
  topP: 0.95,
  topK: 40,
  responseFormat: 'application/json'
};
```

**Database Schema:**
```sql
CREATE TABLE generated_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  full_story_json JSONB NOT NULL,
  word_count INTEGER,
  generation_prompt TEXT,
  gemini_request_id VARCHAR(255),
  content_moderation_passed BOOLEAN DEFAULT FALSE,
  moderation_flags JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE story_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES generated_stories(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  page_text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  word_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(story_id, page_number)
);
```

### 3.4 Image Generation Service

**Gemini 2.5 Flash Integration:**

**Critical Challenge: Character Consistency**

**Approach 1: Reference Image + Detailed Description**
```typescript
interface ImageGenerationRequest {
  pageNumber: number;
  sceneDescription: string; // From story generation
  referenceImages: {
    child: string; // Base64 or URL
    pets?: string[];
  };
  styleGuide: string;
  consistencyPrompt: string;
}

// Consistency prompt example:
// "Generate an illustration in [STYLE] style showing this exact child:
// [Reference image provided]
// 
// Character consistency requirements:
// - MUST match the child's appearance in the reference image
// - Same facial features, hair colour, hair style
// - Age: [AGE] years old
// - Height proportional to age
// 
// Scene: [SCENE_DESCRIPTION]
// 
// Style requirements:
// - [STYLE_GUIDE]
// - Warm, inviting colours
// - Child-friendly, no scary elements
// - Professional storybook quality
// - 1024x1024 resolution
// - Suitable for printing"
```

**Approach 2: Character Embedding (if supported)**
- Extract visual embedding from reference photo
- Include embedding in all generation requests
- Maintain consistency through embedding similarity

**API Configuration:**
```typescript
const geminiImageConfig = {
  model: 'gemini-2.5-flash-image',
  numberOfImages: 1,
  aspectRatio: '1:1', // 1024x1024 for print quality
  safetySettings: {
    harassment: 'BLOCK_MEDIUM_AND_ABOVE',
    hateSpeech: 'BLOCK_MEDIUM_AND_ABOVE',
    sexuallyExplicit: 'BLOCK_HIGH',
    dangerousContent: 'BLOCK_MEDIUM_AND_ABOVE'
  }
};
```

**Process Flow:**
1. Queue image generation jobs (15 images per book)
2. For each page:
   - Build prompt with reference image
   - Call Gemini 2.5 Flash
   - Receive generated image
   - Run content moderation (automated + manual flag)
   - Store to temporary storage
   - Generate thumbnail
3. All images complete → proceed to PDF generation

**Rate Limiting:**
- Maximum 3 concurrent image generations per book
- Retry logic with exponential backoff
- Estimated time: 30-60 seconds per image = 7.5-15 minutes total

**Database Schema:**
```sql
CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  story_page_id UUID REFERENCES story_pages(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_url VARCHAR(512) NOT NULL,
  thumbnail_url VARCHAR(512),
  generation_prompt TEXT NOT NULL,
  gemini_request_id VARCHAR(255),
  width INTEGER DEFAULT 1024,
  height INTEGER DEFAULT 1024,
  file_size_bytes INTEGER,
  content_moderation_passed BOOLEAN DEFAULT FALSE,
  moderation_flags JSONB,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.5 PDF Generation Service

**Requirements:**
- Professional print-quality output
- 8.5" x 8.5" pages (standard children's book)
- Bleed margins for printing
- Embedded fonts
- High-resolution images (300 DPI)
- Cover page with title
- Credits page

**PDF Structure:**
1. **Cover Page**
   - Title (generated or template-based)
   - "A Story About [Child's Name]"
   - Main illustration
   - Date created

2. **Story Pages (15 pages)**
   - Full-page illustration
   - Text overlay or separate text page
   - Page numbers

3. **Back Cover**
   - "Created with [App Name]"
   - Credits
   - Copyright notice

**Implementation Options:**

**Option 1: PDFKit (Node.js)**
```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';

async function generateBook(
  story: GeneratedStory,
  images: GeneratedImage[]
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [612, 792], // 8.5" x 11" in points
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
    info: {
      Title: story.title,
      Author: 'Created by Parent',
      Creator: 'Personalized Storybook App'
    }
  });

  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));

  // Cover page
  addCoverPage(doc, story, images[0]);

  // Story pages
  for (let i = 0; i < story.pages.length; i++) {
    doc.addPage();
    await addStoryPage(doc, story.pages[i], images[i]);
  }

  // Back cover
  doc.addPage();
  addBackCover(doc);

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
  });
}
```

**Option 2: Puppeteer (HTML to PDF)**
- Greater design flexibility
- Easier layout control
- Higher memory usage
- Slower generation

**Recommendation:** Start with PDFKit for control and performance, migrate to Puppeteer if complex layouts required.

**Database Schema:**
```sql
CREATE TABLE generated_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  pdf_url VARCHAR(512) NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- For digital-only orders, delete after download
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP
);
```

### 3.6 Content Moderation System

**Multi-Layer Approach:**

**Layer 1: Gemini Built-in Safety**
- Safety settings enforced during generation
- Automatic blocking of harmful content

**Layer 2: Automated Text Analysis**
```typescript
interface ContentModerationService {
  checkText(text: string): ModerationResult;
  checkImage(imageUrl: string): ModerationResult;
}

interface ModerationResult {
  passed: boolean;
  flags: {
    inappropriate: boolean;
    violent: boolean;
    adult: boolean;
    discriminatory: boolean;
  };
  confidence: number;
  reviewRequired: boolean;
}
```

**Tools:**
- Google Cloud Vision API for image content detection
- OpenAI Moderation API (additional check)
- Custom keyword filtering
- Age-appropriateness checking

**Layer 3: Manual Review Queue**
- All books flagged for review before first download
- Admin dashboard for quick approval/rejection
- Flagging system for user reports

**Database Schema:**
```sql
CREATE TABLE moderation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  review_type VARCHAR(50) NOT NULL, -- 'text' or 'image'
  content_id UUID NOT NULL, -- References story or image
  automated_result JSONB,
  requires_manual_review BOOLEAN DEFAULT FALSE,
  reviewer_user_id UUID REFERENCES users(id),
  review_status VARCHAR(50), -- 'pending', 'approved', 'rejected'
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.7 Payment Processing System

**Stripe Integration:**

**Product Tiers:**
```typescript
interface ProductTier {
  id: string;
  name: string;
  priceNZD: number;
  features: string[];
  stripePriceId: string;
}

const products: ProductTier[] = [
  {
    id: 'digital-pdf',
    name: 'Digital E-Book',
    priceNZD: 29.99,
    features: [
      'Personalized 15-page story',
      'Custom AI illustrations',
      'Downloadable PDF',
      'Unlimited downloads'
    ],
    stripePriceId: 'price_digital_pdf'
  },
  {
    id: 'printed-softcover',
    name: 'Printed Softcover Book',
    priceNZD: 54.99,
    features: [
      'Everything in Digital',
      'Professional softcover printing',
      'Delivered to your door',
      'High-quality paper'
    ],
    stripePriceId: 'price_printed_soft'
  },
  {
    id: 'printed-hardcover',
    name: 'Printed Hardcover Book',
    priceNZD: 74.99,
    features: [
      'Everything in Printed Softcover',
      'Durable hardcover binding',
      'Premium finish',
      'Gift-ready packaging'
    ],
    stripePriceId: 'price_printed_hard'
  }
];
```

**Payment Flow:**
1. User configures book
2. Selects product tier
3. Redirects to Stripe Checkout
4. Stripe processes payment
5. Webhook confirms payment
6. Book processing begins
7. Completion email sent

**Database Schema:**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_checkout_session_id VARCHAR(255),
  amount_nzd DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NZD',
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  product_tier VARCHAR(50) NOT NULL,
  payment_method VARCHAR(100),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  stripe_refund_id VARCHAR(255) UNIQUE NOT NULL,
  amount_nzd DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.8 Print-on-Demand Integration

**Service Options:**

**Option 1: Lulu.com**
- Good New Zealand shipping
- REST API available
- Supports custom sizes
- Softcover and hardcover options

**Option 2: Printful**
- International shipping
- Robust API
- Good quality control
- Shopify integration available

**Implementation:**
```typescript
interface PrintOnDemandService {
  createPrintJob(pdfUrl: string, orderDetails: PrintOrderDetails): Promise<PrintJob>;
  getShippingOptions(destination: Address): Promise<ShippingOption[]>;
  trackOrder(orderId: string): Promise<OrderStatus>;
}

interface PrintOrderDetails {
  bookId: string;
  productType: 'softcover' | 'hardcover';
  pageCount: number;
  shippingAddress: Address;
  customerEmail: string;
}

interface PrintJob {
  externalOrderId: string;
  estimatedDelivery: Date;
  trackingNumber?: string;
  status: PrintJobStatus;
}

type PrintJobStatus = 
  | 'submitted'
  | 'processing'
  | 'printing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';
```

**Database Schema:**
```sql
CREATE TABLE print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES book_orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id),
  external_order_id VARCHAR(255), -- From print service
  product_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'submitted',
  shipping_address_line1 VARCHAR(255) NOT NULL,
  shipping_address_line2 VARCHAR(255),
  shipping_city VARCHAR(100) NOT NULL,
  shipping_postcode VARCHAR(20) NOT NULL,
  shipping_country VARCHAR(100) DEFAULT 'New Zealand',
  recipient_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  tracking_number VARCHAR(255),
  estimated_delivery DATE,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. Security & Privacy Implementation

### 4.1 Child Photo Security

**Critical Requirements:**
- **Zero permanent storage** of children's photos
- **Encryption in transit and at rest**
- **Automatic deletion** after 24 hours
- **No facial recognition database**
- **Audit logging** of all photo access

**Implementation:**
```typescript
interface SecureImageStorage {
  upload(file: File, bookOrderId: string): Promise<SecureImageUrl>;
  getTemporaryUrl(imageId: string, expiryMinutes: number): Promise<string>;
  scheduleDelete(imageId: string, afterHours: number): Promise<void>;
  forceDeleteAll(bookOrderId: string): Promise<void>;
}

// AWS S3 with automatic expiration
const s3Config = {
  bucket: 'personalized-books-temp',
  lifecycleRules: {
    expiration: {
      days: 1 // Auto-delete after 24 hours
    }
  },
  encryption: 'AES256',
  versioning: false, // No version history
  publicAccess: false
};

// Additional encryption layer
async function encryptAndUpload(file: Buffer, key: string): Promise<string> {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(file), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Upload encrypted file
  const s3Url = await s3.upload(encrypted);
  
  // Store decryption key separately (in database, not with file)
  await storeDecryptionKey(s3Url, key, authTag);
  
  return s3Url;
}
```

**Photo Processing Pipeline:**
1. Upload → immediate encryption
2. Generate reference embedding/description
3. Use for AI generation
4. Delete original photo within 24 hours
5. Keep only the generated illustrations
6. Audit log all access

### 4.2 Data Privacy Compliance

**GDPR / Privacy Act Compliance:**

**User Rights:**
- Right to access their data
- Right to delete their data
- Right to export their data
- Right to correct their data
- Right to restrict processing

**Implementation:**
```typescript
interface DataPrivacyService {
  exportUserData(userId: string): Promise<UserDataExport>;
  deleteUserData(userId: string, reason: string): Promise<void>;
  anonymizeUserData(userId: string): Promise<void>;
}

interface UserDataExport {
  personalInfo: UserProfile;
  bookOrders: BookOrder[];
  payments: Payment[];
  generatedPdfs: string[]; // Download URLs
  createdAt: Date;
}

// Automatic data retention
const retentionPolicies = {
  temporaryImages: '24 hours',
  generatedPdfs: '90 days after last download',
  orderHistory: '7 years', // Tax/legal requirement
  userAccounts: 'Until deletion requested'
};
```

**Privacy Policy Requirements:**
- Clear explanation of photo usage
- Explicit consent for AI processing
- Data retention timeframes
- Third-party service disclosure (Gemini, Stripe, Print services)
- Contact information for privacy concerns

**Database Schema:**
```sql
CREATE TABLE privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(100) NOT NULL,
  consent_text TEXT NOT NULL,
  consent_version VARCHAR(50) NOT NULL,
  granted BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  consented_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  request_type VARCHAR(50) NOT NULL, -- 'full_deletion', 'partial_deletion', 'anonymization'
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  result VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.3 Application Security

**Authentication Security:**
- Bcrypt password hashing (cost factor: 12)
- JWT tokens with short expiry (7 days)
- Refresh token rotation
- Rate limiting on login attempts (5 attempts per 15 minutes)
- Email verification required

**API Security:**
- HTTPS only (TLS 1.3)
- CORS configuration (whitelist domains)
- Rate limiting per user (100 requests per minute)
- Request validation with Zod schemas
- SQL injection prevention (Prisma ORM)
- XSS prevention (sanitize inputs)
- CSRF tokens for state-changing requests

**File Upload Security:**
```typescript
const uploadValidation = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  imageValidation: true, // Verify it's actually an image
  virusScan: true, // ClamAV or similar
  dimensionRequirements: {
    minWidth: 512,
    minHeight: 512,
    maxWidth: 4096,
    maxHeight: 4096
  }
};

async function validateUpload(file: File): Promise<ValidationResult> {
  // Check file size
  if (file.size > uploadValidation.maxFileSize) {
    throw new Error('File too large');
  }
  
  // Check mime type
  if (!uploadValidation.allowedMimeTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  // Verify image integrity
  const metadata = await sharp(file.buffer).metadata();
  if (!metadata.format) {
    throw new Error('Invalid image file');
  }
  
  // Check dimensions
  if (metadata.width < uploadValidation.dimensionRequirements.minWidth) {
    throw new Error('Image resolution too low');
  }
  
  // Run virus scan
  await scanForMalware(file.buffer);
  
  return { valid: true };
}
```

---

## 5. User Journey & Workflows

### 5.1 Book Creation Flow

**Step 1: Authentication**
- User creates account or logs in
- Age verification (18+)
- Email verification

**Step 2: Template Selection**
- Browse story templates
- Filter by age range, category
- View template examples
- Option to create custom story

**Step 3: Child Information**
- Upload photo (with privacy notice)
- Enter child's name
- Select age
- Select gender (optional)
- Add favourite colours (multi-select)
- Add interests (free text + suggestions)
- Add personality traits (suggestions)

**Step 4: Pet Information (Optional)**
- Add up to 3 pets
- Upload pet photo for each
- Enter pet name, type, breed, colour

**Step 5: Story Customisation**
- If custom story: enter story prompt/idea
- Select illustration style
- Preview style examples

**Step 6: Review & Confirm**
- Review all information
- Preview estimated completion time
- Terms & privacy consent
- Proceed to payment

**Step 7: Payment**
- Select product tier (digital/softcover/hardcover)
- If printed: enter shipping address
- Stripe checkout
- Payment confirmation

**Step 8: Processing**
- Real-time progress updates
  - "Crafting your story..." (Gemini text generation)
  - "Creating illustrations..." (Progress: 1/15, 2/15, etc.)
  - "Assembling your book..." (PDF generation)
  - "Ready for review!" (Moderation complete)

**Step 9: Preview & Download**
- Email notification when ready
- View PDF preview in browser
- Download digital PDF
- If printed: track shipping status

### 5.2 User Interface Mockup Structure

**Homepage:**
- Hero section with example book
- "Create Your Story" CTA
- How it works (3 steps: Upload, Customize, Download)
- Template gallery
- Testimonials
- Pricing

**Dashboard:**
- "Create New Book" button
- My Books list (status, creation date, actions)
- Account settings
- Billing history

**Creation Wizard:**
- Progress indicator (Steps 1-6)
- Form sections with validation
- Image upload with preview
- Auto-save drafts
- Exit warning if unsaved changes

**Processing Page:**
- Animated progress indicator
- Estimated time remaining
- Real-time status updates via WebSocket
- Option to receive email notification
- "What happens next" information

**Preview Page:**
- PDF viewer (embedded)
- Zoom controls
- Page navigation
- Regenerate options (if not satisfied)
- Download button
- Share/Gift options

---

## 6. API Specifications

### 6.1 Internal API Endpoints

**Authentication:**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh-token
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me
```

**Story Templates:**
```
GET    /api/templates
GET    /api/templates/:id
GET    /api/templates/categories
```

**Book Orders:**
```
POST   /api/books/create
GET    /api/books
GET    /api/books/:id
PUT    /api/books/:id
DELETE /api/books/:id
POST   /api/books/:id/process
GET    /api/books/:id/status
GET    /api/books/:id/preview
GET    /api/books/:id/download
```

**Image Upload:**
```
POST   /api/uploads/child-photo
POST   /api/uploads/pet-photo
DELETE /api/uploads/:id
```

**Payment:**
```
POST   /api/payments/create-checkout-session
GET    /api/payments/:id
POST   /api/payments/webhook (Stripe webhook)
```

**User Management:**
```
GET    /api/users/profile
PUT    /api/users/profile
GET    /api/users/orders
GET    /api/users/export-data
POST   /api/users/delete-account
```

**Admin:**
```
GET    /api/admin/moderation-queue
PUT    /api/admin/moderation/:id/approve
PUT    /api/admin/moderation/:id/reject
GET    /api/admin/analytics
GET    /api/admin/users
```

### 6.2 External API Integration Specifications

**Google Gemini Text Generation:**
```typescript
// Request
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
Headers:
  Content-Type: application/json
  x-goog-api-key: [API_KEY]

Body: {
  contents: [{
    parts: [{
      text: "[STORY_PROMPT]"
    }]
  }],
  generationConfig: {
    temperature: 0.8,
    maxOutputTokens: 4096,
    topP: 0.95,
    topK: 40,
    responseMimeType: "application/json"
  },
  safetySettings: [...]
}

// Response
{
  candidates: [{
    content: {
      parts: [{
        text: "{ \"title\": \"...\", \"pages\": [...] }"
      }]
    },
    finishReason: "STOP",
    safetyRatings: [...]
  }]
}
```

**Google Gemini Image Generation:**
```typescript
// Request
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateImages
Headers:
  Content-Type: application/json
  x-goog-api-key: [API_KEY]

Body: {
  prompt: "[IMAGE_PROMPT]",
  referenceImages: [{
    imageBytes: "[BASE64_ENCODED_IMAGE]",
    description: "Reference photo of child"
  }],
  config: {
    numberOfImages: 1,
    aspectRatio: "1:1",
    outputFormat: "image/png"
  },
  safetySettings: [...]
}

// Response
{
  images: [{
    imageBytes: "[BASE64_ENCODED_IMAGE]",
    mimeType: "image/png"
  }]
}
```

**Stripe Checkout:**
```typescript
// Create checkout session
POST https://api.stripe.com/v1/checkout/sessions
Headers:
  Authorization: Bearer [SECRET_KEY]

Body: {
  payment_method_types: ['card'],
  line_items: [{
    price: 'price_digital_pdf',
    quantity: 1
  }],
  mode: 'payment',
  success_url: 'https://yourapp.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://yourapp.com/cancel',
  metadata: {
    book_order_id: '[BOOK_ORDER_ID]'
  }
}
```

**Lulu Print-on-Demand:**
```typescript
// Create print job
POST https://api.lulu.com/print-jobs/
Headers:
  Authorization: Bearer [ACCESS_TOKEN]
  Content-Type: application/json

Body: {
  line_items: [{
    external_id: '[BOOK_ORDER_ID]',
    title: '[BOOK_TITLE]',
    cover: 'https://yourcdn.com/cover.pdf',
    interior: 'https://yourcdn.com/interior.pdf',
    pod_package_id: 'softcover_standard',
    quantity: 1
  }],
  shipping_address: {...},
  shipping_level: 'STANDARD',
  contact_email: '[EMAIL]'
}
```

---

## 7. Cost Analysis & Pricing Model

### 7.1 Variable Costs per Book

**AI Generation Costs (Google Gemini):**
- Text generation (2.0 Flash): ~$0.50 per book
  - Input: ~500 tokens (prompt)
  - Output: ~2000 tokens (story)
  - Rate: $0.15 per 1M input tokens, $0.60 per 1M output tokens
  
- Image generation (2.5 Flash): ~$7.50 per book
  - 15 images @ ~$0.50 per image
  - Rate: ~$0.50 per image (estimated, verify current pricing)

**Total AI Costs: ~$8.00 NZD per book**

**Print Costs (for physical books):**
- Softcover (via Lulu/Printful): ~$15-20 NZD
- Hardcover: ~$25-30 NZD
- Shipping within NZ: ~$8-12 NZD

**Other Variable Costs:**
- Stripe fees: 2.9% + $0.30 NZD per transaction
- Storage/bandwidth: ~$0.50 per book
- Email notifications: ~$0.02 per book

### 7.2 Fixed Costs (Monthly)

- Hosting (Vercel + AWS): ~$200-500 NZD/month
- Database (PostgreSQL): ~$100-200 NZD/month
- Redis: ~$50-100 NZD/month
- CDN: ~$50-150 NZD/month
- Monitoring & Logging: ~$50-100 NZD/month
- Email service (SendGrid): ~$20-50 NZD/month
- SSL certificates: Included with hosting
- Domain: ~$20 NZD/year

**Total Fixed: ~$470-1,100 NZD/month**

### 7.3 Pricing Strategy

**Digital PDF Only:**
- Cost: $8.00 (AI) + $0.50 (storage) + $1.00 (Stripe) = $9.50
- Retail: $29.99 NZD
- Margin: $20.49 (68%)

**Printed Softcover:**
- Cost: $9.50 (digital) + $18.00 (print) + $10.00 (shipping) + $1.60 (Stripe) = $39.10
- Retail: $54.99 NZD
- Margin: $15.89 (29%)

**Printed Hardcover:**
- Cost: $9.50 (digital) + $28.00 (print) + $10.00 (shipping) + $2.20 (Stripe) = $49.70
- Retail: $74.99 NZD
- Margin: $25.29 (34%)

**Break-Even Analysis:**
- Monthly fixed costs: ~$800 NZD average
- Need ~40 digital book sales/month to break even
- Or ~50 mixed sales/month (70% digital, 30% printed)

---

## 8. Performance & Scalability

### 8.1 Performance Targets

**Page Load Times:**
- Homepage: < 2 seconds
- Dashboard: < 1.5 seconds
- Creation wizard: < 1 second per step
- PDF preview: < 3 seconds

**API Response Times:**
- Authentication: < 300ms
- Template listing: < 500ms
- Book status check: < 200ms
- Image upload: < 5 seconds

**Book Generation Times:**
- Text generation: 30-60 seconds
- Image generation: 7.5-15 minutes (15 images @ 30-60s each)
- PDF creation: 30-60 seconds
- **Total: 9-17 minutes**

### 8.2 Scalability Considerations

**Horizontal Scaling:**
- Stateless API servers (scale based on CPU)
- Separate worker processes for generation tasks
- Redis-based job queue (Bull)
- Database read replicas

**Queue Management:**
```typescript
// Priority-based queue
const bookProcessingQueue = new Queue('book-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Worker concurrency
const workerConfig = {
  textGeneration: { concurrency: 5 }, // Can process 5 stories simultaneously
  imageGeneration: { concurrency: 10 }, // 10 images at once (across all books)
  pdfGeneration: { concurrency: 3 }
};
```

**Caching Strategy:**
- Template data: Cache for 1 hour
- User profile: Cache for 15 minutes
- Story examples: Cache for 24 hours
- Generated PDFs: Cache until download, then 90 days

**CDN Usage:**
- Static assets (images, fonts, CSS, JS)
- Generated PDF downloads
- Template preview images

**Database Optimization:**
- Indexed columns: user_id, book_order_id, status, created_at
- Partitioning: audit_logs table by month
- Connection pooling: Max 20 connections
- Read replicas for analytics queries

### 8.3 Monitoring & Alerts

**Key Metrics:**
- API response times (95th percentile)
- Book generation success rate
- Failed generation jobs
- Queue depth
- Database connection pool usage
- Memory usage per service
- Image generation time per image
- User signup conversion rate
- Payment success rate

**Alerting Thresholds:**
- API response time > 2 seconds
- Generation failure rate > 5%
- Queue depth > 50 jobs
- Database CPU > 80%
- Error rate > 1% of requests
- Storage usage > 80%

**Tools:**
- Application monitoring: DataDog or New Relic
- Error tracking: Sentry
- Uptime monitoring: Pingdom or UptimeRobot
- Log aggregation: CloudWatch or Elasticsearch
- Custom dashboard: Grafana

---

## 9. Testing Strategy

### 9.1 Unit Testing

**Coverage Targets:**
- Core business logic: 90%
- API endpoints: 80%
- Utility functions: 95%

**Key Areas:**
- Story prompt building
- Content moderation logic
- Payment processing
- PDF generation utilities
- Image validation

**Tools:**
- Jest for JavaScript/TypeScript
- React Testing Library for components
- Supertest for API testing

### 9.2 Integration Testing

**Critical Flows:**
1. Complete book creation flow (end-to-end)
2. Payment processing with Stripe test mode
3. Gemini API integration (text & image)
4. PDF generation and download
5. Print-on-demand order submission
6. User authentication flow
7. Data deletion/privacy requests

**Test Data:**
- Mock user accounts
- Sample child photos (stock images)
- Test story templates
- Sandbox payment credentials

### 9.3 User Acceptance Testing

**Test Scenarios:**
1. Create book with various ages (2-12 years)
2. Try different story templates
3. Upload various image formats/sizes
4. Test custom story prompts
5. Verify illustration consistency
6. Check PDF quality on different devices
7. Test payment flows
8. Verify email notifications
9. Mobile responsive testing
10. Accessibility testing (WCAG 2.1 AA)

### 9.4 Security Testing

**Penetration Testing:**
- OWASP Top 10 vulnerabilities
- SQL injection attempts
- XSS attacks
- CSRF attacks
- File upload exploits
- Authentication bypass attempts
- Rate limiting verification

**Privacy Audit:**
- Photo deletion verification
- Data export functionality
- GDPR compliance check
- Consent flow testing
- Audit log completeness

### 9.5 Performance Testing

**Load Testing:**
- Concurrent user simulations (100, 500, 1000 users)
- Peak load handling (50 books being generated simultaneously)
- Database query performance
- API rate limiting verification
- CDN cache effectiveness

**Tools:**
- k6 or Artillery for load testing
- Lighthouse for frontend performance
- Database query profiling

---

## 10. Deployment & DevOps

### 10.1 Infrastructure Setup

**Production Environment:**

**Frontend (Vercel):**
```yaml
# vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.yourdomain.com",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "@stripe-key-prod"
  }
}
```

**Backend (AWS/Google Cloud):**
- EC2 instances or Cloud Run
- Load balancer (ALB or Cloud Load Balancing)
- Auto-scaling group (min: 2, max: 10)
- Worker instances separate from API servers

**Database:**
- AWS RDS PostgreSQL or Google Cloud SQL
- Multi-AZ deployment
- Automated backups (daily)
- Point-in-time recovery enabled
- Read replicas for analytics

**Redis:**
- AWS ElastiCache or Google Cloud Memorystore
- Cluster mode enabled
- Automatic failover

**Storage:**
- AWS S3 or Google Cloud Storage
- Separate buckets:
  - Temporary uploads (lifecycle: 1 day)
  - Generated PDFs (lifecycle: 90 days)
  - Static assets (permanent)
- CloudFront/Cloud CDN in front

### 10.2 CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      
  build-and-deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'

  build-and-deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t personalized-books-api:${{ github.sha }} .
      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
          docker push ${{ secrets.ECR_REGISTRY }}/personalized-books-api:${{ github.sha }}
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster prod-cluster --service api-service --force-new-deployment
```

### 10.3 Deployment Checklist

**Pre-Deployment:**
- [ ] Run full test suite
- [ ] Verify environment variables
- [ ] Database migrations ready
- [ ] Backup current production database
- [ ] Check third-party service status (Gemini, Stripe)
- [ ] Review recent commits
- [ ] Notify team of deployment

**Deployment:**
- [ ] Deploy database migrations
- [ ] Deploy backend services
- [ ] Deploy frontend
- [ ] Verify health checks pass
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Check logs for anomalies

**Post-Deployment:**
- [ ] Verify metrics dashboard
- [ ] Test end-to-end book creation
- [ ] Check payment processing
- [ ] Monitor queue depths
- [ ] Review user feedback channels
- [ ] Update deployment log

### 10.4 Backup & Disaster Recovery

**Backup Strategy:**
- Database: Daily automated backups, 30-day retention
- Critical configuration: Version controlled in Git
- User-uploaded images: Encrypted backups before deletion
- Generated PDFs: Backed up for 90 days

**Recovery Procedures:**
- Database restore: < 1 hour RTO, < 1 hour RPO
- Application recovery: < 30 minutes (rollback deployment)
- Complete system recovery: < 4 hours

**Incident Response:**
1. Detect issue (monitoring alerts)
2. Assess severity
3. Communicate to users (status page)
4. Implement fix or rollback
5. Post-mortem documentation

---

## 11. Legal & Compliance

### 11.1 Terms of Service Key Points

- Users must be 18+ (parental/guardian consent)
- Clear explanation of AI-generated content
- No guarantees on illustration accuracy
- Intellectual property rights (user owns final product)
- Refund policy (before processing starts)
- Limitation of liability
- Prohibited uses (commercial resale, etc.)

### 11.2 Privacy Policy Key Points

- What data is collected
- How photos are processed and deleted
- Third-party services used (Gemini, Stripe, Lulu)
- Data retention periods
- User rights (access, deletion, export)
- Cookie usage
- Contact information for privacy concerns
- Children's Privacy compliance

### 11.3 Content Licensing

**User-Generated Content:**
- Users retain copyright to their photos
- Users grant licence to process photos for book generation
- Licence terminates after book delivery

**AI-Generated Content:**
- Clarify ownership of AI-generated text and images
- User receives full rights to final book
- No commercial resale without permission

### 11.4 Compliance Checklist

- [ ] GDPR compliance (if serving EU customers)
- [ ] New Zealand Privacy Act compliance
- [ ] COPPA compliance (US, if applicable)
- [ ] Payment Card Industry (PCI) compliance (via Stripe)
- [ ] Accessibility standards (WCAG 2.1 AA)
- [ ] Terms of Service lawyer review
- [ ] Privacy Policy lawyer review
- [ ] Cookie consent implementation
- [ ] Data processing agreements with vendors

---

## 12. Launch Strategy

### 12.1 MVP Feature Set

**Phase 1 (Launch):**
- 5 story templates
- Digital PDF download only
- Basic customisation (name, age, interests)
- Single photo upload (child only)
- 2 illustration styles
- Stripe payment integration
- Basic user dashboard

**Phase 2 (3 months post-launch):**
- 10 additional story templates
- Print-on-demand integration
- Pet photo inclusion
- 3 additional illustration styles
- Custom story prompts
- Gift/delivery options
- Regeneration options

**Phase 3 (6 months post-launch):**
- Subscription model (multiple books/month)
- Mobile app (iOS/Android)
- Advanced customisation
- Multiple children per book
- Audio narration option
- Sharing/social features
- Affiliate/referral programme

### 12.2 Marketing & User Acquisition

**Initial Channels:**
- Social media (Facebook, Instagram parent groups)
- Parenting blogs and influencers
- Google Ads (targeted keywords)
- Facebook Ads (parent demographics)
- PR outreach (parenting magazines, tech blogs)
- Product Hunt launch

**Content Marketing:**
- Blog: "Benefits of Personalised Stories for Child Development"
- Video: Behind-the-scenes of book creation
- Customer testimonials and reviews
- Sample books showcase

**Partnership Opportunities:**
- Daycare centres
- Children's bookstores
- Gift shops
- School fundraisers

---

## 13. Success Metrics & Analytics

### 13.1 Key Performance Indicators (KPIs)

**Business Metrics:**
- Monthly Recurring Revenue (MRR)
- Average Order Value (AOV)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Conversion Rate (visitor → purchaser)
- Refund Rate
- Repeat Purchase Rate

**Product Metrics:**
- Books created per month
- Average generation time
- Generation success rate
- Template popularity
- Illustration style preferences
- Digital vs. printed split

**Technical Metrics:**
- API uptime (target: 99.9%)
- Average book generation time
- Failed generation rate (target: < 2%)
- Page load times
- Error rates

**User Engagement:**
- New user signups
- Returning users
- Time on site
- Completion rate (start → payment)
- Drop-off points in creation flow
- Customer satisfaction score (CSAT)

### 13.2 Analytics Implementation

**Tools:**
- Google Analytics 4 (web analytics)
- Mixpanel (product analytics)
- Stripe Dashboard (payment metrics)
- Custom admin dashboard (business metrics)

**Event Tracking:**
- Page views
- Button clicks
- Form completions
- Photo uploads
- Template selections
- Payment initiated/completed
- PDF downloads
- Error encounters

---

## 14. Support & Maintenance

### 14.1 Customer Support

**Support Channels:**
- Email support (response within 24 hours)
- FAQ/Help Centre
- Live chat (business hours initially)
- Social media responses

**Common Support Scenarios:**
- Photo upload issues
- Payment problems
- Book generation delays
- PDF download issues
- Regeneration requests
- Refund requests
- Privacy/deletion requests

**Support Ticketing:**
- Zendesk or Intercom integration
- Ticket categorisation
- SLA tracking
- Customer satisfaction surveys

### 14.2 Ongoing Maintenance

**Regular Tasks:**
- Monitor system health
- Review error logs
- Database optimisation
- Security updates
- Dependency updates
- Cost optimisation
- Performance tuning

**Weekly:**
- Review support tickets
- Check moderation queue
- Analyse user feedback
- Monitor conversion rates

**Monthly:**
- Review analytics
- Cost analysis
- Performance review
- Security audit
- Backup verification
- Update documentation

---

## 15. Future Enhancements

### 15.1 Advanced Features (Future)

**Personalisation Enhancements:**
- Multiple children in one story
- Audio narration (AI voice generation)
- Interactive elements (choose-your-own-adventure)
- Animated page transitions (digital versions)
- AR experiences (scan pages with mobile app)

**Product Expansions:**
- Birthday party invitations
- Thank you cards with character
- Growth chart/milestone books
- Educational workbooks
- Holiday-themed special editions

**Technology Improvements:**
- Video generation (short animated clips)
- 3D character models
- Voice cloning for narration (parent's voice)
- Real-time collaborative editing
- AI-powered illustration refinement

**Business Features:**
- Subscription plans
- Gift subscriptions
- Corporate/bulk orders
- White-label service for bookstores
- API for third-party integrations

---

## 16. Risk Assessment & Mitigation

### 16.1 Technical Risks

**Risk: Gemini API availability/reliability**
- Mitigation: Implement retry logic, queue system, fallback to alternative AI services

**Risk: Character consistency issues**
- Mitigation: Extensive testing, multiple prompt strategies, manual review option

**Risk: High processing costs**
- Mitigation: Cost monitoring, optimisation of prompts, tiered pricing

**Risk: Slow generation times**
- Mitigation: Parallel processing, optimised prompts, set user expectations

**Risk: Security breach**
- Mitigation: Regular security audits, encryption, minimal data retention, incident response plan

### 16.2 Business Risks

**Risk: Low conversion rates**
- Mitigation: A/B testing, user feedback, pricing experiments, marketing optimisation

**Risk: High refund rates**
- Mitigation: Preview options, quality control, clear expectations, satisfaction guarantee

**Risk: Copyright/legal issues**
- Mitigation: Legal review, clear T&Cs, user agreements, content moderation

**Risk: Negative publicity**
- Mitigation: Proactive communication, transparency, excellent customer service, privacy focus

**Risk: Competition**
- Mitigation: Unique features, quality focus, excellent UX, community building

### 16.3 Operational Risks

**Risk: Key person dependency**
- Mitigation: Documentation, knowledge sharing, backup developers

**Risk: Vendor lock-in (Gemini)**
- Mitigation: Abstraction layer, monitor alternative AI services, contract negotiation

**Risk: Scaling costs**
- Mitigation: Cost monitoring, optimisation, pricing adjustments, efficiency improvements

---

## 17. Appendices

### 17.1 Technology Decision Matrix

| Aspect | Option A | Option B | Decision | Rationale |
|--------|----------|----------|----------|-----------|
| Frontend Framework | Next.js | Create React App | **Next.js** | SSR, API routes, better SEO |
| Database | PostgreSQL | MongoDB | **PostgreSQL** | ACID compliance, relational data |
| PDF Generation | PDFKit | Puppeteer | **PDFKit** | Better performance, lower memory |
| Hosting | Vercel + AWS | All-AWS | **Vercel + AWS** | Best of both platforms |
| Payment | Stripe | PayPal | **Stripe** | Better developer experience |
| Print Service | Lulu | Printful | **Lulu** | Better NZ shipping, API quality |

### 17.2 Environment Variables Reference

```bash
# Application
NODE_ENV=production
PORT=3000
APP_URL=https://yourapp.com
API_URL=https://api.yourapp.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://host:6379
REDIS_TLS_ENABLED=true

# Google Gemini
GEMINI_API_KEY=your_api_key
GEMINI_TEXT_MODEL=gemini-2.0-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash

# AWS
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_TEMP=personalized-books-temp
AWS_S3_BUCKET_PDFS=personalized-books-pdfs

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Lulu
LULU_API_KEY=your_api_key
LULU_SANDBOX_MODE=false

# Email
SENDGRID_API_KEY=your_key
SENDGRID_FROM_EMAIL=hello@yourapp.com

# Security
JWT_SECRET=your_secret_key
ENCRYPTION_KEY=your_encryption_key

# Monitoring
SENTRY_DSN=your_sentry_dsn
DATADOG_API_KEY=your_datadog_key
```

### 17.3 Database Schema Summary

**Core Tables:**
- `users` - User accounts
- `user_sessions` - Authentication sessions
- `story_templates` - Available story templates
- `book_orders` - Book creation requests
- `book_pets` - Pet information for books
- `uploaded_images` - Temporary image storage
- `generated_stories` - AI-generated story text
- `story_pages` - Individual story pages
- `generated_images` - AI-generated illustrations
- `generated_pdfs` - Final PDF books
- `payments` - Payment transactions
- `refunds` - Refund records
- `print_orders` - Print-on-demand orders
- `moderation_reviews` - Content moderation records
- `privacy_consents` - User consent tracking
- `data_deletion_requests` - GDPR deletion requests
- `audit_logs` - System audit trail

---

## Document Control

**Version History:**
- 1.0 (24 Oct 2025): Initial specification

**Review Schedule:**
- Technical review: Monthly
- Security review: Quarterly
- Compliance review: Annually

**Distribution:**
- Development team
- Project stakeholders
- Legal/compliance team

**Contact:**
- Technical Lead: [Contact]
- Project Manager: [Contact]
- Security Officer: [Contact]

---

**End of Technical Specification Document**
