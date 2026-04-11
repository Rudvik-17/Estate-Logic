-- Fix: add INSERT policy to users table so new users can create their own row.
-- The original migration (001) only added SELECT and UPDATE policies.
-- Run this in the Supabase SQL editor if you already ran 001_create_tables.sql.

CREATE POLICY "Users can insert own row" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
