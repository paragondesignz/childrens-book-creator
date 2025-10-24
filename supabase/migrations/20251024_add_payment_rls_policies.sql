-- Add Row Level Security policies for payments table
-- This allows authenticated users to insert their own payment records

-- Enable RLS on payments table (if not already enabled)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own payment records
DROP POLICY IF EXISTS "Users can create own payments" ON payments;
CREATE POLICY "Users can create own payments" ON payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own payment records
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to view payments for their books
DROP POLICY IF EXISTS "Users can view payments for own books" ON payments;
CREATE POLICY "Users can view payments for own books" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM book_orders
      WHERE book_orders.id = payments.book_order_id
      AND book_orders.user_id = auth.uid()
    )
  );
