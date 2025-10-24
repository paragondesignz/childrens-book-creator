-- Add INSERT policy for book_orders table to allow users to create their own books
CREATE POLICY "Users can create own book orders" ON public.book_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add SELECT policy for book_orders so users can view their own books
CREATE POLICY "Users can view own book orders" ON public.book_orders
  FOR SELECT USING (auth.uid() = user_id);

-- Add UPDATE policy for book_orders (for status updates, etc)
CREATE POLICY "Users can update own book orders" ON public.book_orders
  FOR UPDATE USING (auth.uid() = user_id);
