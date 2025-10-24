# Deployment Guide

## Quick Fix for Current Production Issues

### 1. Fix RLS Policies (CRITICAL - Do This First!)

The signup and book creation are currently failing due to missing Row Level Security policies.

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/vffhnsdadogyhyggduow)
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the following SQL:

```sql
-- Add INSERT policy for users table to allow signup
CREATE POLICY "Users can insert own data during signup" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Ensure story templates are readable by everyone
DROP POLICY IF EXISTS "Anyone can view active story templates" ON public.story_templates;
CREATE POLICY "Anyone can view story templates" ON public.story_templates
  FOR SELECT USING (true);

-- Allow users to insert their own book pets
CREATE POLICY "Users can create own book pets" ON public.book_pets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.book_orders
      WHERE book_orders.id = book_pets.book_order_id
      AND book_orders.user_id = auth.uid()
    )
  );

-- Allow users to insert their own uploaded images
CREATE POLICY "Users can create own uploaded images" ON public.uploaded_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.book_orders
      WHERE book_orders.id = uploaded_images.book_order_id
      AND book_orders.user_id = auth.uid()
    )
  );
```

5. Click "Run" (or press Cmd/Ctrl + Enter)
6. Verify you see "Success. No rows returned"

### 2. Deploy Worker Process

The book generation worker needs to run separately from the Next.js app.

#### Option A: Railway (Recommended)

1. Go to [Railway.app](https://railway.app) and create new project
2. Select "Deploy from GitHub repo"
3. Choose your `childrens-book-creator` repository
4. Add these environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://vffhnsdadogyhyggduow.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GEMINI_API_KEY=your_gemini_key
   REDIS_URL=your_redis_url
   REDIS_TLS_ENABLED=true
   ```
5. Set the start command: `npm run worker`
6. Deploy!

#### Option B: Render

1. Go to [Render.com](https://render.com)
2. Create new "Background Worker"
3. Connect your GitHub repository
4. Set build command: `npm install`
5. Set start command: `npm run worker`
6. Add all environment variables from above
7. Deploy!

#### Option C: Run Locally (For Testing)

```bash
# In a separate terminal window
npm run worker:dev
```

## Environment Variables

### Vercel (Already Set)
These are already configured in your Vercel deployment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `REDIS_URL`
- `REDIS_TLS_ENABLED`

### Worker Service (Railway/Render)
Make sure to set these same variables on your worker service.

## Testing the Fixed Application

### Test Signup Flow
1. Visit your production URL
2. Click "Sign Up"
3. Fill in the form with valid data (must be 18+)
4. Click "Create account"
5. You should see success message and redirect to login

### Test Book Creation Flow
1. Login with your account
2. Click "Create Story"
3. Complete all 5 wizard steps:
   - Step 1: Choose template or custom story
   - Step 2: Add child info and photo
   - Step 3: Add pets (optional)
   - Step 4: Select style, colors, interests, traits
   - Step 5: Review everything
4. Click "Create My Storybook"
5. Click "Continue to Processing" on checkout page
6. You should see the status page with progress indicator

### Progress Indicator

The status page (`/books/[id]/status`) shows real-time progress:
- ✅ Processing Order (10%)
- ✅ Generating Story (40%)
- ✅ Creating Illustrations (70%)
- ✅ Assembling PDF (90%)
- ✅ Complete (100%)

The page updates automatically via Supabase Realtime subscriptions.

## Current Features

### ✅ Working
- User authentication (signup/login)
- 5-step book creation wizard
- File uploads to Supabase Storage
- Mock payment system
- Real-time status tracking
- BullMQ job queue (when worker is running)
- Story generation with Gemini AI
- Placeholder image generation
- PDF assembly
- PDF download

### 🔄 Needs Worker Running
- Actual book generation
- Story AI processing
- Image creation
- PDF assembly

### 📋 Phase 2 (Future Enhancements)
- Email notifications when book is ready
- Real Stripe payment integration
- Actual AI-generated images (Gemini 2.5 Flash)
- Print service integration
- Enhanced dashboard filtering/search

## Troubleshooting

### "401 Unauthorized" errors
- Run the RLS policy SQL from step 1 above

### "Books not generating"
- Make sure worker process is running
- Check worker logs for errors
- Verify Redis connection is working

### "500 Internal Server Error"
- Check Vercel deployment logs
- Verify all environment variables are set
- Check Supabase table structure matches migrations

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Check Supabase logs in Dashboard
3. Check worker process logs (Railway/Render)
4. Verify all environment variables are correct
