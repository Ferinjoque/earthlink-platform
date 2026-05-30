-- =============================================================================
-- Migración 007: RLS real basado en roles — reemplaza políticas phase1_open
-- Roles: supplier (solo su proveedor) | consultant (lectura total en org) | admin (org completa)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Eliminar políticas abiertas de Fase 1
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "phase1_open" ON public.organizations;
DROP POLICY IF EXISTS "phase1_open" ON public.suppliers;
DROP POLICY IF EXISTS "phase1_open" ON public.memberships;
DROP POLICY IF EXISTS "phase1_open" ON public.reporting_periods;
DROP POLICY IF EXISTS "phase1_open" ON public.activity_entries;
DROP POLICY IF EXISTS "phase1_open" ON public.emission_results;
DROP POLICY IF EXISTS "phase1_open" ON public.evidence_files;
DROP POLICY IF EXISTS "phase1_open" ON public.anomaly_flags;

-- ---------------------------------------------------------------------------
-- Helper: ¿es el usuario actual miembro de una org dada?
-- SECURITY DEFINER para poder leer memberships sin recursión de RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid() AND organization_id = p_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_user_role_in_org(p_org_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.memberships
  WHERE user_id = auth.uid() AND organization_id = p_org_id
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- Los miembros leen su org. Los admins escriben. Service role sin restricción.
-- ---------------------------------------------------------------------------
CREATE POLICY "org_select" ON public.organizations FOR SELECT
  USING (public.fn_is_org_member(id));

CREATE POLICY "org_insert" ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "org_update" ON public.organizations FOR UPDATE
  USING (public.fn_user_role_in_org(id) = 'admin')
  WITH CHECK (public.fn_user_role_in_org(id) = 'admin');

-- ---------------------------------------------------------------------------
-- suppliers
-- Cualquier miembro de la org lee. Admin/consultant escriben.
-- ---------------------------------------------------------------------------
CREATE POLICY "supplier_select" ON public.suppliers FOR SELECT
  USING (public.fn_is_org_member(organization_id));

CREATE POLICY "supplier_insert" ON public.suppliers FOR INSERT
  WITH CHECK (public.fn_user_role_in_org(organization_id) IN ('admin', 'consultant'));

CREATE POLICY "supplier_update" ON public.suppliers FOR UPDATE
  USING (public.fn_user_role_in_org(organization_id) IN ('admin', 'consultant'))
  WITH CHECK (public.fn_user_role_in_org(organization_id) IN ('admin', 'consultant'));

-- ---------------------------------------------------------------------------
-- memberships
-- Los usuarios ven su propia fila. Los admins ven todas en la org.
-- ---------------------------------------------------------------------------
CREATE POLICY "membership_own" ON public.memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "membership_org_admin" ON public.memberships FOR SELECT
  USING (
    public.fn_user_role_in_org(organization_id) = 'admin'
  );

CREATE POLICY "membership_insert" ON public.memberships FOR INSERT
  WITH CHECK (
    public.fn_user_role_in_org(organization_id) = 'admin'
    OR auth.uid() = user_id   -- auto-registro via enlace de invitación
  );

-- ---------------------------------------------------------------------------
-- reporting_periods
-- Todos los miembros de la org leen. Admin/consultant escriben y actualizan (transiciones de estado).
-- ---------------------------------------------------------------------------
CREATE POLICY "period_select" ON public.reporting_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = reporting_periods.supplier_id
        AND public.fn_is_org_member(s.organization_id)
    )
  );

CREATE POLICY "period_insert" ON public.reporting_periods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = reporting_periods.supplier_id
        AND public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  );

CREATE POLICY "period_update" ON public.reporting_periods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = reporting_periods.supplier_id
        AND public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  );

-- ---------------------------------------------------------------------------
-- activity_entries
-- Todos los miembros de la org leen.
-- Los suppliers insertan para su propio periodo de reporte.
-- Admin/consultant insertan para cualquier periodo en su org.
-- ---------------------------------------------------------------------------
CREATE POLICY "activity_select" ON public.activity_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.reporting_periods rp
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE rp.id = activity_entries.reporting_period_id
        AND public.fn_is_org_member(s.organization_id)
    )
  );

CREATE POLICY "activity_insert_supplier" ON public.activity_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reporting_periods rp
      JOIN public.memberships m ON m.supplier_id = rp.supplier_id
      WHERE rp.id = activity_entries.reporting_period_id
        AND m.user_id = auth.uid()
        AND m.role = 'supplier'
    )
  );

CREATE POLICY "activity_insert_staff" ON public.activity_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reporting_periods rp
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE rp.id = activity_entries.reporting_period_id
        AND public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  );

CREATE POLICY "activity_update_staff" ON public.activity_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.reporting_periods rp
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE rp.id = activity_entries.reporting_period_id
        AND public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  );

-- ---------------------------------------------------------------------------
-- emission_results  (solo-append — sin política INSERT significa que solo service_role escribe)
-- Todos los miembros de la org leen sus resultados.
-- ---------------------------------------------------------------------------
CREATE POLICY "emission_result_select" ON public.emission_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.reporting_periods rp
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE rp.id = emission_results.reporting_period_id
        AND public.fn_is_org_member(s.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- evidence_files
-- Todos los miembros de la org leen. Cualquier miembro autenticado inserta; eliminación por dueño o admin.
-- ---------------------------------------------------------------------------
CREATE POLICY "evidence_select" ON public.evidence_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.activity_entries ae
      JOIN public.reporting_periods rp ON rp.id = ae.reporting_period_id
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE ae.id = evidence_files.activity_entry_id
        AND public.fn_is_org_member(s.organization_id)
    )
  );

CREATE POLICY "evidence_insert" ON public.evidence_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.activity_entries ae
      JOIN public.reporting_periods rp ON rp.id = ae.reporting_period_id
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE ae.id = evidence_files.activity_entry_id
        AND public.fn_is_org_member(s.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- anomaly_flags  (lectura para consultant/admin; sin escritura desde cliente — solo service_role)
-- ---------------------------------------------------------------------------
CREATE POLICY "anomaly_select" ON public.anomaly_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.activity_entries ae
      JOIN public.reporting_periods rp ON rp.id = ae.reporting_period_id
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE ae.id = anomaly_flags.activity_entry_id
        AND public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  );
