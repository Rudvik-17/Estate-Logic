-- Seed Data for EstateLogic
-- IMPORTANT: Replace the UUIDs below with your actual owner and tenant user IDs
-- from Supabase Auth (Authentication > Users in your dashboard).
-- Run 001_create_tables.sql first.

-- Step 1: After creating your owner user via the app, update their role:
-- UPDATE public.users SET role = 'owner', full_name = 'Vikram Malhotra' WHERE id = '<your-owner-uid>';

-- Step 2: After creating your tenant user via the app, update their role:
-- UPDATE public.users SET role = 'tenant', full_name = 'Arjun Sharma' WHERE id = '<your-tenant-uid>';

-- =========================================================
-- The rest uses placeholder UUIDs that you must replace.
-- =========================================================

DO $$
DECLARE
  owner_uid uuid := '00000000-0000-0000-0000-000000000001'; -- replace with real owner uid
  tenant1_uid uuid := '00000000-0000-0000-0000-000000000002'; -- replace with real tenant uid
  prop1_id uuid := gen_random_uuid();
  prop2_id uuid := gen_random_uuid();
  tenant1_id uuid := gen_random_uuid();
  tenant2_id uuid := gen_random_uuid();
  tenant3_id uuid := gen_random_uuid();
  tenant4_id uuid := gen_random_uuid();
  lease1_id uuid := gen_random_uuid();
  lease2_id uuid := gen_random_uuid();
  lease3_id uuid := gen_random_uuid();
  lease4_id uuid := gen_random_uuid();
BEGIN

  -- Properties
  INSERT INTO public.properties (id, owner_id, name, address, city, total_units, avg_rent) VALUES
    (prop1_id, owner_uid, 'The Sterling Heights', 'Whitefield Main Road, Whitefield', 'Bangalore', 120, 420000),
    (prop2_id, owner_uid, 'Skyline Atrium', 'Bandra Kurla Complex', 'Mumbai', 45, 352750);

  -- Tenants
  INSERT INTO public.tenants (id, user_id, owner_id, property_id, full_name, unit_number, email, phone, status) VALUES
    (tenant1_id, tenant1_uid, owner_uid, prop1_id, 'Arjun Sharma', '402-B', 'arjun.sharma@email.com', '+91 98765 43210', 'active'),
    (tenant2_id, NULL, owner_uid, prop1_id, 'Priya Nair', '1105-A', 'priya.nair@email.com', '+91 87654 32109', 'active'),
    (tenant3_id, NULL, owner_uid, prop2_id, 'Rahul Mehta', '201-C', 'rahul.mehta@email.com', '+91 76543 21098', 'active'),
    (tenant4_id, NULL, owner_uid, prop2_id, 'Sneha Iyer', '304-D', 'sneha.iyer@email.com', '+91 65432 10987', 'pending');

  -- Leases
  INSERT INTO public.leases (id, tenant_id, property_id, start_date, end_date, monthly_rent, status, signed_at) VALUES
    (lease1_id, tenant1_id, prop1_id, '2023-10-01', '2024-09-30', 420000, 'active', '2023-09-28 14:30:00+05:30'),
    (lease2_id, tenant2_id, prop1_id, '2023-08-01', '2024-07-31', 435000, 'active', '2023-07-25 11:00:00+05:30'),
    (lease3_id, tenant3_id, prop2_id, '2023-09-01', '2024-08-31', 352750, 'active', '2023-08-29 10:00:00+05:30'),
    (lease4_id, tenant4_id, prop2_id, '2024-01-01', '2025-12-31', 380000, 'pending_signature', NULL);

  -- Payments (3 months history for tenant1)
  INSERT INTO public.payments (tenant_id, lease_id, amount, due_date, paid_at, status, payment_method, transaction_id) VALUES
    -- Oct 2023 (paid)
    (tenant1_id, lease1_id, 420000, '2023-10-05', '2023-10-03 10:45:00+05:30', 'paid', 'gpay', 'TXN9842034821'),
    -- Nov 2023 (paid)
    (tenant1_id, lease1_id, 420000, '2023-11-05', '2023-11-02 09:30:00+05:30', 'paid', 'phonepe', 'TXN8731924632'),
    -- Dec 2023 (pending)
    (tenant1_id, lease1_id, 420000, '2023-12-05', NULL, 'pending', NULL, NULL),
    -- Tenant 2 payments
    (tenant2_id, lease2_id, 435000, '2023-10-05', '2023-10-04 11:20:00+05:30', 'paid', 'gpay', 'TXN7621813543'),
    (tenant2_id, lease2_id, 435000, '2023-11-05', '2023-11-01 08:15:00+05:30', 'paid', 'gpay', 'TXN6512702454'),
    (tenant2_id, lease2_id, 435000, '2023-12-05', NULL, 'pending', NULL, NULL),
    -- Tenant 3 payments
    (tenant3_id, lease3_id, 352750, '2023-10-05', '2023-10-05 16:00:00+05:30', 'paid', 'paytm', 'TXN5403691365'),
    (tenant3_id, lease3_id, 352750, '2023-11-05', NULL, 'overdue', NULL, NULL);

  -- Maintenance Requests
  INSERT INTO public.maintenance_requests (tenant_id, property_id, subject, details, status, priority, case_number, resolution_progress, scheduled_visit) VALUES
    (tenant1_id, prop1_id, 'Leaky Faucet - Kitchen', 'The kitchen faucet has been dripping continuously for the past 2 days causing water damage near the sink cabinet.', 'in_progress', 'medium', 'EL-4902', 65, NOW() + INTERVAL '1 day'),
    (tenant2_id, prop1_id, 'AC not working', 'The split AC in the master bedroom stopped cooling. The unit turns on but blows warm air.', 'in_progress', 'high', 'ISS-8831', 40, NOW() + INTERVAL '3 hours'),
    (tenant3_id, prop2_id, 'Door Lock Issue', 'The digital PIN lock on the main door intermittently fails to recognize the registered PIN codes.', 'open', 'medium', 'ISS-8911', 0, NULL),
    (tenant1_id, prop1_id, 'Hallway Light Flickering', 'The corridor light outside Unit 402-B has been flickering for a week.', 'resolved', 'low', 'ISS-8720', 100, NULL);

  -- Transactions (financial ledger)
  INSERT INTO public.transactions (property_id, type, category, amount, description, date) VALUES
    -- Sterling Heights Oct 2023
    (prop1_id, 'rent', 'residential', 420000, 'Rent - Arjun Sharma - Unit 402-B', '2023-10-03'),
    (prop1_id, 'rent', 'residential', 435000, 'Rent - Priya Nair - Unit 1105-A', '2023-10-04'),
    (prop1_id, 'expense', 'maintenance', 12500, 'Plumbing repair - common area pipes', '2023-10-10'),
    (prop1_id, 'expense', 'staff', 45000, 'Security & housekeeping - October', '2023-10-31'),
    -- Skyline Atrium Oct 2023
    (prop2_id, 'rent', 'residential', 352750, 'Rent - Rahul Mehta - Unit 201-C', '2023-10-05'),
    (prop2_id, 'expense', 'utilities', 28000, 'Common area electricity - October', '2023-10-31'),
    (prop2_id, 'expense', 'maintenance', 8750, 'Elevator maintenance - quarterly', '2023-10-15'),
    -- Nov 2023
    (prop1_id, 'rent', 'residential', 420000, 'Rent - Arjun Sharma - Unit 402-B', '2023-11-02'),
    (prop1_id, 'rent', 'residential', 435000, 'Rent - Priya Nair - Unit 1105-A', '2023-11-01'),
    (prop2_id, 'rent', 'residential', 352750, 'Rent - Rahul Mehta - Unit 201-C', '2023-11-03');

END $$;
