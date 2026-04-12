-- Tenant auto-linking policies
-- Allow a newly-registered user to find and claim their own unlinked tenant row
-- by matching auth.email() before user_id has been set.
--
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/olswwdunaivwxefelasc/sql

-- SELECT: let authenticated user read rows that were pre-created with their email
-- but haven't been linked yet (user_id IS NULL).
-- The existing "Tenants view own record" policy already covers linked rows.
CREATE POLICY "Tenants can find unlinked row by email"
  ON public.tenants
  FOR SELECT
  USING (
    email = auth.email()
    AND user_id IS NULL
  );

-- UPDATE: let authenticated user claim the unlinked row by setting user_id.
-- USING  — matches rows the user is allowed to update (their email, not yet linked).
-- WITH CHECK — ensures user_id can only be set to auth.uid() (prevents spoofing).
CREATE POLICY "Tenants can claim unlinked row by email"
  ON public.tenants
  FOR UPDATE
  USING (
    email = auth.email()
    AND user_id IS NULL
  )
  WITH CHECK (
    user_id = auth.uid()
  );
