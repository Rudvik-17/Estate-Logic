-- Run in: https://supabase.com/dashboard/project/olswwdunaivwxefelasc/sql

-- 1. Add property_type to the existing properties table
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'apartment'
  CHECK (property_type IN ('apartment', 'house', 'villa', 'commercial'));

-- 2. Units table — one row per physical unit in a property
CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  status text NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, unit_number)
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages their units" ON public.units
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS units_property_id_idx ON public.units (property_id);
