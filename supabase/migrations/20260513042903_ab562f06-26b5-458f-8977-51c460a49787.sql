
-- Fix function search path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Restrict listing of asset-images bucket: only allow SELECT for specific paths via signed access not needed; drop broad SELECT and re-add (still public read for direct URLs works because bucket is public)
DROP POLICY IF EXISTS "Public read asset images" ON storage.objects;
CREATE POLICY "Auth read asset images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'asset-images');

UPDATE storage.buckets SET public = false WHERE id = 'asset-images';
