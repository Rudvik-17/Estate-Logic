-- 1. Alter public.users to add age and gender
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age int;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender text;

-- 2. Alter public.properties to add image_url
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS image_url text;

-- 3. Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('properties', 'properties', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Setup storage policies
-- Drop policies if they exist to avoid duplication
DROP POLICY IF EXISTS "Public Access avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Access properties" ON storage.objects;
DROP POLICY IF EXISTS "Auth Manage avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Manage properties" ON storage.objects;

-- Create public read policies
CREATE POLICY "Public Access avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Public Access properties" ON storage.objects FOR SELECT USING (bucket_id = 'properties');

-- Create authenticated management policies
CREATE POLICY "Auth Manage avatars" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Auth Manage properties" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'properties') WITH CHECK (bucket_id = 'properties');
