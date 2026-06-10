INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-images', 'ad-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload ad images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ad-images');

CREATE POLICY "Anyone can view ad images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'ad-images');

CREATE POLICY "Authenticated users can delete own ad images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ad-images');
