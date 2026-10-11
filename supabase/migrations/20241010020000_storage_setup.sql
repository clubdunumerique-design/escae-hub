-- Migration: 20241010020000_storage_setup
-- Description: Creation du bucket Supabase pour les documents de projets et configuration de la securite (RLS)

-- 1. Creation du bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('project_documents', 'project_documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS est activé par défaut sur storage.objects par Supabase
-- (ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; -- géré par Supabase)

-- 3. Politiques de securite (RLS) pour storage.objects

CREATE POLICY "Les porteurs peuvent uploader des documents" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'project_documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.projects WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Le staff et le porteur peuvent lire les documents" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'project_documents' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.projects WHERE owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'verifier', 'director', 'reviewer', 'scheduler')
    )
  )
);

CREATE POLICY "Les porteurs peuvent supprimer leurs documents" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'project_documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.projects WHERE owner_id = auth.uid()
  )
);
