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
