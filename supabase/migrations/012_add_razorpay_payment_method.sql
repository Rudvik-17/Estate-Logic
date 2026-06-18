-- Migration 012: Add Razorpay payment method constraint
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('gpay', 'phonepe', 'paytm', 'razorpay'));
