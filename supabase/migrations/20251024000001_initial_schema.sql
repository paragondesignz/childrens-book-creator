-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  date_of_birth DATE,
  age_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Story templates
CREATE TABLE IF NOT EXISTS public.story_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) UNIQUE NOT NULL,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Book orders
CREATE TABLE IF NOT EXISTS public.book_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.story_templates(id),
  child_first_name VARCHAR(100) NOT NULL,
  child_age INTEGER NOT NULL,
  child_gender VARCHAR(50),
  favourite_colours JSONB,
  interests JSONB,
  personality_traits JSONB,
  custom_story_prompt TEXT,
  illustration_style VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Book pets
CREATE TABLE IF NOT EXISTS public.book_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  pet_name VARCHAR(100) NOT NULL,
  pet_type VARCHAR(50) NOT NULL,
  breed VARCHAR(100),
  colour VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Uploaded images
CREATE TABLE IF NOT EXISTS public.uploaded_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  image_type VARCHAR(50) NOT NULL,
  original_filename VARCHAR(255),
  storage_url VARCHAR(512) NOT NULL,
  encrypted_url VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated stories
CREATE TABLE IF NOT EXISTS public.generated_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID UNIQUE REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  full_story_json JSONB NOT NULL,
  word_count INTEGER,
  generation_prompt TEXT,
  gemini_request_id VARCHAR(255),
  content_moderation_passed BOOLEAN DEFAULT FALSE,
  moderation_flags JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Story pages
CREATE TABLE IF NOT EXISTS public.story_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.generated_stories(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  page_text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  word_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id, page_number)
);

-- Generated images
CREATE TABLE IF NOT EXISTS public.generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  story_page_id UUID REFERENCES public.story_pages(id),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated PDFs
CREATE TABLE IF NOT EXISTS public.generated_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID UNIQUE REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  pdf_url VARCHAR(512) NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP WITH TIME ZONE
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_checkout_session_id VARCHAR(255),
  amount_nzd DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NZD',
  status VARCHAR(50) DEFAULT 'pending',
  product_tier VARCHAR(50) NOT NULL,
  payment_method VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refunds
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
  stripe_refund_id VARCHAR(255) UNIQUE NOT NULL,
  amount_nzd DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Print orders
CREATE TABLE IF NOT EXISTS public.print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  payment_id UUID REFERENCES public.payments(id),
  external_order_id VARCHAR(255),
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
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation reviews
CREATE TABLE IF NOT EXISTS public.moderation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_order_id UUID REFERENCES public.book_orders(id) ON DELETE CASCADE NOT NULL,
  review_type VARCHAR(50) NOT NULL,
  content_id UUID NOT NULL,
  automated_result JSONB,
  requires_manual_review BOOLEAN DEFAULT FALSE,
  reviewer_user_id UUID REFERENCES public.users(id),
  review_status VARCHAR(50),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Privacy consents
CREATE TABLE IF NOT EXISTS public.privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  consent_type VARCHAR(100) NOT NULL,
  consent_text TEXT NOT NULL,
  consent_version VARCHAR(50) NOT NULL,
  granted BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data deletion requests
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  result VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_book_orders_user_id ON public.book_orders(user_id);
CREATE INDEX idx_book_orders_status ON public.book_orders(status);
CREATE INDEX idx_book_orders_created_at ON public.book_orders(created_at DESC);
CREATE INDEX idx_story_pages_story_id ON public.story_pages(story_id);
CREATE INDEX idx_generated_images_book_order_id ON public.generated_images(book_order_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_book_order_id ON public.payments(book_order_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only read their own data
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Book orders policies
CREATE POLICY "Users can view own book orders" ON public.book_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own book orders" ON public.book_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own book orders" ON public.book_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own book orders" ON public.book_orders
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for related tables
CREATE POLICY "Users can view own book pets" ON public.book_pets
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.book_orders WHERE id = book_order_id));

CREATE POLICY "Users can view own uploaded images" ON public.uploaded_images
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.book_orders WHERE id = book_order_id));

CREATE POLICY "Users can view own generated stories" ON public.generated_stories
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.book_orders WHERE id = book_order_id));

CREATE POLICY "Users can view own story pages" ON public.story_pages
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.book_orders bo JOIN public.generated_stories gs ON bo.id = gs.book_order_id WHERE gs.id = story_id));

CREATE POLICY "Users can view own generated images" ON public.generated_images
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.book_orders WHERE id = book_order_id));

CREATE POLICY "Users can view own generated PDFs" ON public.generated_pdfs
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.book_orders WHERE id = book_order_id));

CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own privacy consents" ON public.privacy_consents
  FOR SELECT USING (auth.uid() = user_id);

-- Story templates are publicly readable
CREATE POLICY "Anyone can view active story templates" ON public.story_templates
  FOR SELECT USING (is_active = true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_book_orders_updated_at BEFORE UPDATE ON public.book_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
