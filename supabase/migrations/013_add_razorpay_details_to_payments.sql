-- Migration 013: Add razorpay_payment_id and razorpay_order_id to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_order_id text;
