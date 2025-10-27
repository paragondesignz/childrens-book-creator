-- Add hometown and favourite_foods columns to book_orders table
ALTER TABLE book_orders
ADD COLUMN IF NOT EXISTS hometown VARCHAR(200),
ADD COLUMN IF NOT EXISTS favourite_foods JSONB;
