-- EstateLogic Schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/olswwdunaivwxefelasc/sql

-- Users table extension (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'tenant' CHECK (role IN ('owner', 'tenant')),
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own row" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own row" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Properties
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  total_units int NOT NULL DEFAULT 1,
  avg_rent numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their properties" ON public.properties
  USING (auth.uid() = owner_id);

-- Tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  unit_number text NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'exiting')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their tenants" ON public.tenants
  USING (auth.uid() = owner_id);
CREATE POLICY "Tenants view own record" ON public.tenants FOR SELECT
  USING (auth.uid() = user_id);

-- Leases
CREATE TABLE IF NOT EXISTS public.leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending_signature')),
  signed_at timestamptz,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner accesses leases for own properties" ON public.leases
  USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
  );
CREATE POLICY "Tenant views own lease" ON public.leases FOR SELECT
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid())
  );

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  payment_method text CHECK (payment_method IN ('gpay', 'phonepe', 'paytm')),
  transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views payments for own tenants" ON public.payments
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  );
CREATE POLICY "Tenant views own payments" ON public.payments FOR SELECT
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant inserts own payments" ON public.payments FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant updates own payments" ON public.payments FOR UPDATE
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid())
  );

-- Maintenance Requests
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  subject text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  case_number text NOT NULL,
  resolution_progress int NOT NULL DEFAULT 0 CHECK (resolution_progress BETWEEN 0 AND 100),
  scheduled_visit timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views maintenance for own properties" ON public.maintenance_requests
  USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
  );
CREATE POLICY "Tenant manages own requests" ON public.maintenance_requests
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid())
  );

-- Transactions (financial ledger for owner)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('rent', 'expense', 'maintenance_cost')),
  category text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views own property transactions" ON public.transactions
  USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
  );
