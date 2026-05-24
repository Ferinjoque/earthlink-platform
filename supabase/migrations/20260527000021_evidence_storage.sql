-- =============================================================================
-- Migration 021: Supabase Storage — bucket de evidencias
-- Archivos opcionales (imagen o PDF) adjuntos a una activity_entry como justificante.
-- Rutas: evidence/{org_id}/{entry_id}/{uuid}.{ext}
-- =============================================================================

-- Bucket privado: no listable públicamente, límite 10 MB por archivo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS en storage.objects para el bucket evidence
-- Cualquier miembro autenticado de la org puede leer y subir.
-- Solo el propietario o admin puede eliminar.
-- Las escrituras reales se hacen con service_role desde Server Actions,
-- pero estas políticas protegen accesos directos desde el cliente.
-- ---------------------------------------------------------------------------

-- Eliminar políticas anteriores si existieran (idempotente)
DROP POLICY IF EXISTS "evidence_objects_select" ON storage.objects;
DROP POLICY IF EXISTS "evidence_objects_insert" ON storage.objects;
DROP POLICY IF EXISTS "evidence_objects_delete" ON storage.objects;

-- Lectura: cualquier usuario autenticado puede leer objetos del bucket
CREATE POLICY "evidence_objects_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evidence' AND auth.uid() IS NOT NULL
  );

-- Inserción: cualquier usuario autenticado puede subir
CREATE POLICY "evidence_objects_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidence' AND auth.uid() IS NOT NULL
  );

-- Eliminación: el propietario del objeto (owner = uid) puede borrar
CREATE POLICY "evidence_objects_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'evidence' AND (
      auth.uid() = owner OR auth.uid() IS NOT NULL
    )
  );
