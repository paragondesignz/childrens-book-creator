# Architecture Documentation

## Overview

This application creates AI-generated personalized children's storybooks. It follows a **simplified serverless architecture** optimized for deployment on Vercel with Supabase as the backend.

## Architecture Principles

### 1. **Serverless-First**
- All processing happens within Vercel's serverless functions
- No need for separate server infrastructure
- Automatic scaling based on demand

### 2. **Simple & Reliable**
- Minimal dependencies and moving parts
- Easy to understand and maintain
- Fewer failure points

### 3. **Cost-Effective**
- No Redis hosting required
- No separate worker infrastructure
- Pay only for what you use

## System Components

### Frontend Layer
- **Technology**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Purpose**: User interface for book creation, payment, and status monitoring
- **Location**: `/app` directory

### API Layer
- **Technology**: Next.js API Routes
- **Purpose**: Handle user requests, authentication, and trigger processing
- **Key Routes**:
  - `/api/books` - CRUD operations for book orders
  - `/api/books/[id]/process` - Mark book for processing
  - `/api/books/[id]/mock-payment` - Development payment simulation
  - `/api/cron/process-books` - Background processing endpoint
  - `/api/templates` - Story template management

### Service Layer
- **Technology**: TypeScript service classes
- **Purpose**: Encapsulate business logic for story/image/PDF generation
- **Location**: `/services` directory
- **Services**:
  - `StoryGenerationService` - Generates story text with Gemini
  - `ImageGenerationService` - Creates illustrations (placeholder implementation)
  - `PDFGenerationService` - Produces final PDF books

### Database Layer
- **Technology**: Supabase (PostgreSQL)
- **Purpose**: Store all application data
- **Schema Location**: `/supabase/migrations`
- **Key Features**:
  - Row Level Security (RLS) for data isolation
  - Automatic user sync with Supabase Auth
  - Comprehensive audit logging

### Storage Layer
- **Technology**: Supabase Storage
- **Purpose**: Store uploaded photos, generated images, and PDFs
- **Buckets**:
  - `uploaded-photos` - Temporary child photos (24-hour expiry)
  - `generated-images` - AI-generated illustrations
  - `generated-pdfs` - Final book PDFs

## Background Processing Architecture

### Simplified Approach (Current Implementation)

The application uses **Vercel Cron Jobs** for background processing instead of traditional queue systems like BullMQ/Redis.

**How it works:**

1. **User triggers processing** → API endpoint marks book status as "processing"
2. **Vercel Cron runs every 5 minutes** → Checks for books with status "processing"
3. **Cron processes books sequentially** → Generates story, images, and PDF
4. **Status updated to "completed"** → User can download their book

**Benefits:**
- ✅ No Redis infrastructure to maintain
- ✅ No separate worker processes
- ✅ Simple to understand and debug
- ✅ Automatic retries via cron re-runs
- ✅ Cost-effective for low-to-medium volume

**Trade-offs:**
- ⏱️ Processing starts within 5 minutes (not instant)
- 🔢 Processes one book at a time per cron run
- ⏰ Maximum 5-minute execution time per book

### Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-books",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Alternative Considered (BullMQ - Not Used)

The codebase contains BullMQ/Redis code in `/lib/workers` and `/lib/queues` but **this is not actively used**. This code remains for reference if you need to scale to high-volume processing.

**When to switch to BullMQ:**
- Processing >100 books per hour
- Need instant processing (< 1 minute latency)
- Require complex job prioritization
- Need advanced retry strategies

## Data Flow

### Book Creation Flow

```
1. User fills out wizard → POST /api/books
   ↓
2. Frontend uploads child photo → Supabase Storage (encrypted, 24hr expiry)
   ↓
3. User completes payment → Stripe → Webhook → Mark status: "processing"
   ↓
4. Vercel Cron (every 5 min) → GET books WHERE status = "processing"
   ↓
5. Story Generation → Gemini 2.0 Flash → Save to DB
   ↓
6. Image Generation (x15) → Gemini 2.5 Flash → Save to Supabase Storage
   ↓
7. PDF Generation → PDFKit → Save to Supabase Storage
   ↓
8. Update status: "completed" → Send notification email
```

### Processing States

- **draft** - Book configured but not paid
- **processing** - Payment received, waiting for/in processing
- **generating-story** - Creating story text with AI
- **generating-images** - Creating 8 illustrations (6 story pages + 2 covers)
- **creating-pdf** - Assembling final PDF
- **completed** - Book ready for download
- **failed** - Error occurred (with error_message)

## Database Schema

### Core Tables

**users** - Extends Supabase auth.users
- Stores additional user profile information
- Links to all user-owned resources

**story_templates** - Pre-built story themes
- Publicly readable
- Contains prompt templates and style guides

**book_orders** - Book creation requests
- User's book configuration and personalization
- Status tracking
- Error logging

**generated_stories** - AI-generated story content
- Full story JSON (title + 6 pages)
- Generation metadata
- Moderation flags

**story_pages** - Individual story pages
- Page number + text + image prompt
- Links to generated images

**generated_images** - AI-generated illustrations
- Image URLs (main + thumbnail)
- Generation metadata
- Moderation flags

**generated_pdfs** - Final PDF books
- PDF URL
- File metadata
- Download tracking

**payments** - Stripe payment records
- Payment intent tracking
- Links to book orders

### Security: Row Level Security (RLS)

All tables have RLS policies ensuring:
- Users can only access their own data
- Service role key can bypass RLS for admin operations
- Story templates are publicly readable

## Critical Fixes Applied

### 1. Database Field Mismatches ✅

**Problem**: Services were inserting data with incorrect field names
**Fix**:
- `storyGeneration.service.ts`: Changed `full_text` → `full_story_json`
- `pdfGeneration.service.ts`: Changed `storage_url` → `pdf_url`

### 2. Unreliable Fire-and-Forget HTTP ✅

**Problem**: Process endpoint was doing HTTP fetch without awaiting
**Fix**: Removed fire-and-forget, let cron handle all processing
**Result**: More reliable, simpler code

### 3. Duplicate Processing Code ✅

**Problem**: Same logic in both `bookWorker.ts` and `cron/process-books/route.ts`
**Fix**: Cron is the single source of truth for processing
**Result**: Removed code duplication

### 4. Excessive Cron Frequency ✅

**Problem**: Running every 2 minutes was wasteful
**Fix**: Changed to every 5 minutes
**Result**: 60% reduction in serverless invocations

## Environment Variables

### Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini AI
GEMINI_API_KEY=your-api-key
GEMINI_TEXT_MODEL=gemini-2.0-flash-exp
GEMINI_IMAGE_MODEL=gemini-2.5-flash

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Optional (Legacy - Not Used)

```env
# Redis (for BullMQ - not actively used)
REDIS_URL=redis://localhost:6379
REDIS_TLS_ENABLED=false

# AWS S3 (if using instead of Supabase Storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_TEMP=...
AWS_S3_BUCKET_PDFS=...
```

## Monitoring & Debugging

### Logging

All services and endpoints include comprehensive console logging:
- `[process]` - Processing endpoint logs
- `[mock-payment]` - Payment simulation logs
- `[process-books]` - Cron job logs
- `console.log` in services - Generation progress

### Status Monitoring

Users can monitor their book status at `/books/[id]/status` which polls the database every 3 seconds for status updates.

### Error Handling

- All errors are caught and logged with full stack traces
- Book orders are marked as `failed` with `error_message` for debugging
- User sees friendly error messages, detailed logs in console

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch
4. Vercel Cron automatically configured from `vercel.json`

### Supabase

1. Create project at supabase.com
2. Link local project: `supabase link --project-ref your-ref`
3. Push migrations: `supabase db push`
4. Set up storage buckets via Supabase dashboard

## Future Improvements

### Short-term
- [ ] Implement actual AI image generation (currently using placeholders)
- [ ] Add real Stripe payment processing (beyond mock)
- [ ] Implement photo encryption service
- [ ] Add 24-hour photo auto-deletion cron job
- [ ] Implement content moderation API calls

### Medium-term
- [ ] Add email notifications when books are ready
- [ ] Implement print-on-demand integration (Lulu/Printful)
- [ ] Add social sharing features
- [ ] Create admin dashboard for moderation

### Long-term (If Scaling Needed)
- [ ] Migrate to BullMQ for higher throughput
- [ ] Implement Redis caching for templates
- [ ] Add CDN for generated PDFs
- [ ] Implement job prioritization

## Conclusion

This architecture prioritizes **simplicity and reliability** over complex infrastructure. It's designed for:
- **Small to medium volume** (< 100 books/hour)
- **Serverless deployment** (Vercel)
- **Minimal operational overhead**
- **Easy debugging and maintenance**

If you need to scale beyond these constraints, the BullMQ infrastructure code is available but not connected. Migrating would involve:
1. Deploying Redis instance
2. Activating queue in `/api/books/[id]/process`
3. Deploying worker process separately
4. Removing Vercel Cron dependency
