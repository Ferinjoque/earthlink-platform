-- Añadir columna archived_at a suppliers para soft-delete
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- RLS: excluir archivados del SELECT para roles que no son admin
-- Los admins siguen viendo todos; consultores y suppliers solo ven activos
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;

CREATE POLICY "suppliers_select" ON public.suppliers
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
        AND (
          role = 'admin'
          OR (role IN ('consultant', 'supplier') AND archived_at IS NULL)
        )
    )
  );
