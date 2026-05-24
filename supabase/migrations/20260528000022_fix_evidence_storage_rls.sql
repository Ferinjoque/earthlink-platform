-- =============================================================================
-- Migración 022: Endurecimiento de políticas RLS para bucket de evidencias
-- Problema: migración 021 permitía a cualquier usuario autenticado leer/subir/eliminar
-- archivos de cualquier organización. Se restringe por membresía en la org propietaria.
-- La ruta del objeto tiene formato: {org_id}/{entry_id}/{uuid}.{ext}
-- Se extrae org_id con split_part(name, '/', 1) y se verifica membresía.
-- =============================================================================

-- Eliminar políticas anteriores
DROP POLICY IF EXISTS "evidence_objects_select" ON storage.objects;
DROP POLICY IF EXISTS "evidence_objects_insert" ON storage.objects;
DROP POLICY IF EXISTS "evidence_objects_delete" ON storage.objects;

-- Lectura: solo miembros de la org propietaria del archivo
CREATE POLICY "evidence_objects_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND memberships.organization_id = split_part(name, '/', 1)::uuid
    )
  );

-- Inserción: solo miembros de la org propietaria (los Server Actions usan service_role,
-- esta política es defensa en profundidad contra accesos directos del cliente)
CREATE POLICY "evidence_objects_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND memberships.organization_id = split_part(name, '/', 1)::uuid
    )
  );

-- Eliminación: solo admin o consultant de la org propietaria
CREATE POLICY "evidence_objects_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND memberships.organization_id = split_part(name, '/', 1)::uuid
        AND memberships.role IN ('admin', 'consultant')
    )
  );
