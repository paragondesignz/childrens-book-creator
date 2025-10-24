# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web application that creates AI-generated personalized children's storybooks. Parents can upload photos of their child (and pets), select story templates or create custom stories, and receive a professionally formatted 15-page illustrated e-book as a PDF or printed book.

**Key Technologies:**
- Frontend: Next.js 14+ (App Router), TypeScript, React 18+, Tailwind CSS
- Backend: Next.js API Routes, Node.js 20+, TypeScript
- Database: PostgreSQL 15+ with Prisma ORM
- Cache/Queue: Redis 7+ with Bull/BullMQ
- AI: Google Gemini 2.0 Flash (text), Gemini 2.5 Flash (images)
- Payment: Stripe
- PDF Generation: PDFKit
- Storage: AWS S3 or Google Cloud Storage
- Print-on-Demand: Lulu API or Printful API

## Core Architecture

### Multi-Layer System
The application follows a service-oriented architecture with clear separation of concerns:

1. **Frontend Layer**: Next.js with TypeScript, form wizard for book creation, real-time progress updates
2. **API Gateway Layer**: Next.js API routes handling authentication, validation, rate limiting
3. **Application Services**:
   - Story Generation Service (Gemini 2.0 Flash)
   - Image Generation Service (Gemini 2.5 Flash)
   - PDF Generation Service (PDFKit)
   - Content Moderation Service
   - Payment Processing Service (Stripe)
   - Print-on-Demand Service (Lulu/Printful)
4. **Data Layer**: PostgreSQL, Redis for caching/queuing, temporary object storage

### Critical Design Principles

**Security & Privacy - THIS IS PARAMOUNT:**
- Child photos MUST be deleted within 24 hours (auto-expiry on S3)
- All photos encrypted at rest with AES-256-GCM
- No permanent storage of children's photos - only generated illustrations are kept
- Audit logging for all photo access
- GDPR/Privacy Act compliance required

**Character Consistency Challenge:**
The hardest technical problem is maintaining consistent character appearance across 15 illustrations. Use reference images in every Gemini prompt + detailed character descriptions. Consider extracting visual embeddings from reference photos if Gemini API supports it.

**Asynchronous Processing:**
Book generation takes 9-17 minutes (text: 30-60s, images: 7.5-15 mins for 15 images, PDF: 30-60s). All processing MUST happen in background queues (Bull/BullMQ) with real-time status updates to users via WebSocket or polling.

## Database Schema

Key tables as defined in the tech spec (docs/personalized-ebook-tech-spec.md):
- `users`, `user_sessions` - Authentication
- `story_templates`, `book_orders` - Core book creation
- `book_pets`, `uploaded_images` - Personalization data
- `generated_stories`, `story_pages` - AI-generated text
- `generated_images` - AI-generated illustrations
- `generated_pdfs` - Final products
- `payments`, `refunds`, `print_orders` - Commerce
- `moderation_reviews` - Content safety
- `privacy_consents`, `data_deletion_requests`, `audit_logs` - Compliance

All UUIDs for primary keys. Use JSONB for flexible data (colours, interests, traits). Include proper indexes on user_id, book_order_id, status, created_at.

## Development Commands

### Initial Setup
```bash
# Install dependencies
npm install

# Set up environment variables (copy .env.example to .env)
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database with story templates
npm run db:seed
```

### Development
```bash
# Start development server (frontend + API)
npm run dev

# Start background workers separately
npm run worker:dev

# Run database studio (Prisma UI)
npx prisma studio
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Type check
npm run type-check
```

### Database
```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate
```

### Build & Deploy
```bash
# Build production bundle
npm run build

# Start production server
npm start

# Build Docker image
docker build -t personalized-books .

# Run Docker container
docker run -p 3000:3000 personalized-books
```

## Code Organization Patterns

### Service Layer Pattern
All business logic should be in services, not API routes:

```typescript
// services/storyGeneration.service.ts
export class StoryGenerationService {
  async generateStory(config: BookConfiguration): Promise<GeneratedStory> {
    // Build prompt from template + user config
    // Call Gemini API
    // Validate response
    // Run content moderation
    // Store to database
  }
}
```

API routes should be thin controllers:
```typescript
// app/api/books/[id]/process/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  const bookOrder = await db.bookOrder.findUnique({ where: { id: params.id } });

  // Validate ownership, etc.

  // Queue background job
  await bookProcessingQueue.add('generate-book', { bookOrderId: params.id });

  return NextResponse.json({ status: 'processing' });
}
```

### Queue-Based Processing
Use Bull queues for all long-running operations:

```typescript
// workers/bookProcessing.worker.ts
bookProcessingQueue.process('generate-book', async (job) => {
  const { bookOrderId } = job.data;

  // Update status: 'generating-story'
  await storyGenerationService.generateStory(bookOrderId);

  // Update status: 'generating-images'
  await imageGenerationService.generateImages(bookOrderId);

  // Update status: 'creating-pdf'
  await pdfGenerationService.createPDF(bookOrderId);

  // Update status: 'completed'
  await notificationService.sendCompletionEmail(bookOrderId);
});
```

### Prompt Engineering Pattern
Prompts are critical. Store prompt templates separately:

```typescript
// prompts/storyGeneration.prompts.ts
export const buildStoryPrompt = (config: BookConfiguration, template: StoryTemplate): string => {
  return `Write a 15-page children's story for ${config.childInfo.firstName}, a ${config.childInfo.age}-year-old child.

Story Template: ${template.title}
${template.description}

Child's Interests: ${config.childInfo.interests.join(', ')}
Child's Personality: ${config.childInfo.personalityTraits.join(', ')}
Favourite Colours: ${config.childInfo.favouriteColours.join(', ')}
${config.petInfo ? `Pet: ${config.petInfo[0].name}, a ${config.petInfo[0].colour} ${config.petInfo[0].type}` : ''}

Requirements:
- Age-appropriate language for ${config.childInfo.age}-year-olds
- Positive, encouraging themes
- ${config.childInfo.firstName} should be the protagonist and hero
- Story should be exactly 15 pages
- Each page should have 50-100 words
- Include engaging dialogue
- Educational elements appropriate for age
- Safe, positive resolution

Return as JSON with this exact structure:
{
  "title": "story title here",
  "pages": [
    {
      "pageNumber": 1,
      "text": "page text here (50-100 words)",
      "imagePrompt": "detailed description for illustration"
    }
  ]
}`;
};
```

### Image Consistency Pattern
For character consistency, ALWAYS include reference image + detailed description in every prompt:

```typescript
// prompts/imageGeneration.prompts.ts
export const buildImagePrompt = (
  page: StoryPage,
  childInfo: ChildInformation,
  style: IllustrationStyle
): ImageGenerationRequest => {
  return {
    prompt: `Generate an illustration in ${style} style.

CRITICAL: This must show the EXACT same child as in the reference image provided.
- Same facial features, hair colour, hair style, eye colour
- Age: ${childInfo.age} years old
- Height and proportions appropriate for age ${childInfo.age}

Scene: ${page.imagePrompt}

Style requirements:
- ${getStyleGuide(style)}
- Warm, inviting colours (especially ${childInfo.favouriteColours.join(', ')})
- Child-friendly, no scary or dark elements
- Professional storybook quality
- 1024x1024 resolution
- High quality suitable for printing at 300 DPI`,
    referenceImages: [{
      imageUrl: childInfo.photoUrl,
      description: `Reference photo of ${childInfo.firstName}, the child character`
    }],
    config: {
      numberOfImages: 1,
      aspectRatio: '1:1',
      outputFormat: 'image/png'
    }
  };
};
```

## Content Moderation Strategy

**Multi-layer approach required:**
1. Gemini's built-in safety settings (enforced during generation)
2. Automated text/image analysis (Google Cloud Vision API, OpenAI Moderation API)
3. Custom keyword filtering for age-appropriateness
4. Manual review queue for first-time users or flagged content

All content MUST pass automated checks before being shown to users. Manual review can happen asynchronously for final approval.

## Payment Integration Notes

Use Stripe Checkout for payment processing. Flow:
1. User configures book
2. Create Stripe Checkout Session with book_order_id in metadata
3. Redirect to Stripe
4. Stripe webhook confirms payment → trigger book processing
5. Never start processing before payment confirmation

Webhook verification is critical - always verify signature:
```typescript
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constitutEvent(req.body, sig, webhookSecret);
```

## File Upload Security

**CRITICAL SECURITY CHECKS:**
```typescript
// Validate every upload:
- Check MIME type is image/jpeg, image/png, or image/webp
- Verify actual file content matches MIME (use Sharp metadata check)
- Max file size: 10MB
- Min dimensions: 512x512
- Max dimensions: 4096x4096
- Run malware scan if possible
- Encrypt immediately after upload
- Set auto-expiry to 24 hours on S3
- Never store unencrypted photos
```

## Testing Requirements

**Unit Test Coverage Targets:**
- Core business logic (services): 90%
- API endpoints: 80%
- Utility functions: 95%

**Critical Integration Tests:**
1. Complete book creation flow (end-to-end)
2. Payment processing with Stripe test mode
3. Gemini API integration (use test fixtures/mocks to avoid costs)
4. PDF generation and download
5. Photo upload → encryption → auto-deletion
6. User data deletion/export (GDPR compliance)

**Mock expensive API calls in tests:**
- Use fixtures for Gemini responses
- Use Stripe test mode
- Mock S3 operations in unit tests

## Environment Variables

Critical environment variables (see section 17.2 of tech spec for full list):
- `GEMINI_API_KEY` - Google Gemini API key
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe keys
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `AWS_S3_BUCKET_TEMP` - Temporary photo storage (24hr expiry)
- `AWS_S3_BUCKET_PDFS` - Generated PDF storage
- `ENCRYPTION_KEY` - For photo encryption (AES-256)
- `JWT_SECRET` - For session tokens

## Performance Targets

- Homepage load: < 2 seconds
- API endpoints: < 500ms (except file uploads)
- Book generation total: 9-17 minutes (this is acceptable, set user expectations)
- Text generation: 30-60 seconds
- Image generation: 30-60 seconds per image (15 images = 7.5-15 mins)
- PDF generation: 30-60 seconds

Use parallel processing where possible:
- Generate multiple images concurrently (max 3 per book to respect rate limits)
- Process multiple book orders simultaneously in separate workers

## Common Pitfalls to Avoid

1. **Never store child photos permanently** - this is a legal/ethical requirement
2. **Always validate payment before processing** - check webhook signature
3. **Don't generate books synchronously** - always use background jobs
4. **Character consistency is hard** - invest time in prompt engineering
5. **Content moderation is required** - never skip this step
6. **Rate limiting on Gemini API** - implement exponential backoff retry logic
7. **Handle failed generations gracefully** - provide clear error messages and retry options
8. **GDPR compliance** - implement data export and deletion properly
9. **Cost monitoring** - each book costs ~$8 in API calls, monitor closely
10. **PDF file sizes** - optimize images for web while maintaining print quality

## Project Status

This project is currently in the **planning phase**. The technical specification document is complete (see docs/personalized-ebook-tech-spec.md). Implementation has not yet begun.

**Recommended first steps for development:**
1. Set up Next.js project with TypeScript
2. Configure Prisma with PostgreSQL
3. Implement database schema from tech spec
4. Build authentication system (NextAuth.js)
5. Create story template management
6. Implement file upload with encryption
7. Integrate Gemini API for text generation
8. Integrate Gemini API for image generation
9. Build PDF generation service
10. Add payment processing
11. Implement background job processing
12. Add content moderation
13. Build print-on-demand integration

## Reference Documentation

- Full Technical Specification: `docs/personalized-ebook-tech-spec.md`
- Database schema details: Tech spec section 3.1-3.8
- API specifications: Tech spec section 6
- Security requirements: Tech spec section 4
- Testing strategy: Tech spec section 9
