-- DocuSign e-signature integration columns for leases table
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/olswwdunaivwxefelasc/sql

-- Add DocuSign tracking columns
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT,
  ADD COLUMN IF NOT EXISTS docusign_status TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS docusign_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS docusign_signed_at TIMESTAMPTZ;

-- Constrain docusign_status to valid values
ALTER TABLE public.leases
  ADD CONSTRAINT leases_docusign_status_check
  CHECK (docusign_status IN ('not_sent', 'sent', 'delivered', 'completed', 'declined', 'voided'));

-- Index for fast webhook lookups by envelope ID
CREATE INDEX IF NOT EXISTS idx_leases_docusign_envelope_id
  ON public.leases (docusign_envelope_id)
  WHERE docusign_envelope_id IS NOT NULL;
