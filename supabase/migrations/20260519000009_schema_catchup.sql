-- =============================================================================
-- Migración 009: Sincronización de esquema + seed + usuario demo
-- La BD remota tenía un esquema antiguo de 4 tablas que conflictúa con la reconstrucción de 15 tablas.
-- Esta migración elimina las tablas antiguas, crea el esquema completo de forma idempotente,
-- inserta datos de referencia + demo y crea el usuario de autenticación demo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Eliminar tablas antiguas conflictivas (orden de dependencia FK)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.environmental_evaluations CASCADE;
DROP TABLE IF EXISTS public.suppliers                 CASCADE;
DROP TABLE IF EXISTS public.companies                 CASCADE;
DROP TABLE IF EXISTS public.emission_factors          CASCADE;

-- ---------------------------------------------------------------------------
-- 1. Reference tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_types (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         text        NOT NULL,
  label        text        NOT NULL,
  scope        smallint    NOT NULL CHECK (scope = 1),
  activity_kind text       NOT NULL CHECK (activity_kind IN ('stationary_combustion', 'mobile_combustion')),
  created_at   timestamptz DEFAULT now() NOT NULL,

  UNIQUE (code, activity_kind)
);

CREATE TABLE IF NOT EXISTS public.refrigerants (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code       text        NOT NULL UNIQUE,
  label      text        NOT NULL,
  gwp_ar6    numeric(10, 2) NOT NULL CHECK (gwp_ar6 > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.grid_regions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code       text        NOT NULL UNIQUE,
  label      text        NOT NULL,
  country    text        NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.emission_factors (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type    text        NOT NULL CHECK (source_type IN (
                               'stationary_combustion',
                               'mobile_combustion',
                               'purchased_electricity',
                               'purchased_steam',
                               'fugitive'
                             )),
  fuel_type_id   uuid        REFERENCES public.fuel_types(id)    ON DELETE RESTRICT,
  refrigerant_id uuid        REFERENCES public.refrigerants(id)  ON DELETE RESTRICT,
  grid_region_id uuid        REFERENCES public.grid_regions(id)  ON DELETE RESTRICT,
  co2e_per_unit  numeric(18, 8) NOT NULL CHECK (co2e_per_unit > 0),
  unit           text        NOT NULL,
  scope          smallint    NOT NULL CHECK (scope IN (1, 2)),
  source_db      text        NOT NULL,
  valid_from     date        NOT NULL,
  valid_to       date,
  created_at     timestamptz DEFAULT now() NOT NULL,
  activity_key   text,
  set_id         text,
  set_version    text,

  CONSTRAINT ck_ef_combustion_has_fuel CHECK (
    source_type NOT IN ('stationary_combustion', 'mobile_combustion')
    OR fuel_type_id IS NOT NULL
  ),
  CONSTRAINT ck_ef_fugitive_has_refrigerant CHECK (
    source_type <> 'fugitive' OR refrigerant_id IS NOT NULL
  ),
  CONSTRAINT ck_ef_electricity_has_region CHECK (
    source_type <> 'purchased_electricity' OR grid_region_id IS NOT NULL
  ),
  CONSTRAINT ck_ef_valid_range CHECK (
    valid_to IS NULL OR valid_to > valid_from
  )
);

CREATE INDEX IF NOT EXISTS idx_ef_source_type ON public.emission_factors (source_type);
CREATE INDEX IF NOT EXISTS idx_ef_fuel_type   ON public.emission_factors (fuel_type_id) WHERE fuel_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ef_grid_region ON public.emission_factors (grid_region_id) WHERE grid_region_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.unit_conversions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  from_unit  text        NOT NULL,
  to_unit    text        NOT NULL,
  factor     numeric(18, 8) NOT NULL CHECK (factor > 0),
  notes      text,
  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE (from_unit, to_unit)
);

-- ---------------------------------------------------------------------------
-- 2. Access tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        NOT NULL,
  industry   text        NOT NULL,
  ruc        text,
  country    text        NOT NULL DEFAULT 'PE',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  category        text        NOT NULL,
  contact_email   text,
  ruc             text,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers (organization_id);

CREATE TABLE IF NOT EXISTS public.memberships (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('supplier', 'consultant', 'admin')),
  supplier_id     uuid        REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invited_at      timestamptz DEFAULT now() NOT NULL,
  accepted_at     timestamptz,

  UNIQUE (user_id, organization_id),
  CONSTRAINT ck_supplier_role_has_supplier CHECK (
    role <> 'supplier' OR supplier_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org  ON public.memberships (organization_id);

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Transactional tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_periods (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid        NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  label       text        NOT NULL,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'calculating', 'under_review', 'locked')),
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT ck_period_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_periods_supplier        ON public.reporting_periods (supplier_id);
CREATE INDEX IF NOT EXISTS idx_periods_supplier_status ON public.reporting_periods (supplier_id, status);

DROP TRIGGER IF EXISTS trg_reporting_periods_updated_at ON public.reporting_periods;
CREATE TRIGGER trg_reporting_periods_updated_at
  BEFORE UPDATE ON public.reporting_periods
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TABLE IF NOT EXISTS public.activity_entries (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  reporting_period_id uuid        NOT NULL REFERENCES public.reporting_periods(id) ON DELETE CASCADE,
  source_type         text        NOT NULL CHECK (source_type IN (
                                    'stationary_combustion',
                                    'mobile_combustion',
                                    'purchased_electricity',
                                    'purchased_steam',
                                    'fugitive'
                                  )),
  activity_kind       jsonb       NOT NULL,
  raw_quantity        numeric(18, 4) NOT NULL CHECK (raw_quantity >= 0),
  raw_unit            text        NOT NULL,
  fuel_type_id        uuid        REFERENCES public.fuel_types(id)   ON DELETE RESTRICT,
  refrigerant_id      uuid        REFERENCES public.refrigerants(id) ON DELETE RESTRICT,
  grid_region_id      uuid        REFERENCES public.grid_regions(id) ON DELETE RESTRICT,
  notes               text,
  status              text        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'submitted', 'validated', 'rejected')),
  submitted_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at        timestamptz,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_period      ON public.activity_entries (reporting_period_id);
CREATE INDEX IF NOT EXISTS idx_entries_source_type ON public.activity_entries (source_type);
CREATE INDEX IF NOT EXISTS idx_entries_status      ON public.activity_entries (status);

DROP TRIGGER IF EXISTS trg_activity_entries_updated_at ON public.activity_entries;
CREATE TRIGGER trg_activity_entries_updated_at
  BEFORE UPDATE ON public.activity_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TABLE IF NOT EXISTS public.emission_results (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_entry_id   uuid        NOT NULL REFERENCES public.activity_entries(id) ON DELETE RESTRICT,
  reporting_period_id uuid        NOT NULL REFERENCES public.reporting_periods(id) ON DELETE RESTRICT,
  scope               smallint    NOT NULL CHECK (scope IN (1, 2)),
  co2e_kg             numeric(20, 6) NOT NULL CHECK (co2e_kg >= 0),
  factor_used         numeric(18, 8) NOT NULL,
  factor_unit         text        NOT NULL,
  normalized_quantity numeric(18, 4) NOT NULL,
  normalized_unit     text        NOT NULL,
  calc_hash           text        NOT NULL UNIQUE,
  calc_version        text        NOT NULL,
  emission_factor_id  uuid        REFERENCES public.emission_factors(id) ON DELETE RESTRICT,
  calculated_at       timestamptz DEFAULT now() NOT NULL,
  calculated_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_results_entry  ON public.emission_results (activity_entry_id);
CREATE INDEX IF NOT EXISTS idx_results_period ON public.emission_results (reporting_period_id);
CREATE INDEX IF NOT EXISTS idx_results_scope  ON public.emission_results (scope);

CREATE TABLE IF NOT EXISTS public.evidence_files (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_entry_id uuid        NOT NULL REFERENCES public.activity_entries(id) ON DELETE CASCADE,
  storage_path      text        NOT NULL,
  mime_type         text        NOT NULL,
  file_size_bytes   bigint      NOT NULL CHECK (file_size_bytes > 0),
  original_name     text        NOT NULL,
  sha256            text        NOT NULL,
  uploaded_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at       timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_entry ON public.evidence_files (activity_entry_id);

CREATE TABLE IF NOT EXISTS public.anomaly_flags (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_entry_id uuid        NOT NULL REFERENCES public.activity_entries(id) ON DELETE CASCADE,
  detector          text        NOT NULL CHECK (detector IN ('zscore_monthly', 'unit_mismatch', 'factor_outlier')),
  severity          text        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  z_score           numeric(8, 4),
  threshold_used    numeric(8, 4),
  message           text        NOT NULL,
  is_resolved       boolean     NOT NULL DEFAULT false,
  resolved_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  flagged_at        timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT ck_resolved_has_ts CHECK (
    NOT is_resolved OR resolved_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_anomalies_entry    ON public.anomaly_flags (activity_entry_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON public.anomaly_flags (severity) WHERE NOT is_resolved;

-- ---------------------------------------------------------------------------
-- 4. Audit tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  action       text        NOT NULL,
  table_name   text,
  record_id    uuid,
  old_values   jsonb,
  new_values   jsonb,
  performed_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at timestamptz DEFAULT now() NOT NULL,
  ip_address   inet,
  user_agent   text
);

CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON public.audit_log (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON public.audit_log (performed_by);

CREATE TABLE IF NOT EXISTS public.report_exports (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  reporting_period_ids uuid[]      NOT NULL,
  format               text        NOT NULL CHECK (format IN ('pdf', 'csv', 'json')),
  scope_filter         smallint[]  NOT NULL DEFAULT ARRAY[1, 2]::smallint[],
  file_url             text        NOT NULL,
  file_sha256          text        NOT NULL,
  generated_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at         timestamptz DEFAULT now() NOT NULL,
  expires_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_exports_org       ON public.report_exports (organization_id);
CREATE INDEX IF NOT EXISTS idx_exports_generated ON public.report_exports (generated_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Triggers: append-only guards + auto-audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Table "%" is append-only. Mutating record "%" is not permitted.',
    TG_TABLE_NAME, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_emission_results_no_update ON public.emission_results;
DROP TRIGGER IF EXISTS trg_emission_results_no_delete ON public.emission_results;
CREATE TRIGGER trg_emission_results_no_update
  BEFORE UPDATE ON public.emission_results
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();
CREATE TRIGGER trg_emission_results_no_delete
  BEFORE DELETE ON public.emission_results
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON public.audit_log;
DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON public.audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

DROP TRIGGER IF EXISTS trg_report_exports_no_update ON public.report_exports;
DROP TRIGGER IF EXISTS trg_report_exports_no_delete ON public.report_exports;
CREATE TRIGGER trg_report_exports_no_update
  BEFORE UPDATE ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();
CREATE TRIGGER trg_report_exports_no_delete
  BEFORE DELETE ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

CREATE OR REPLACE FUNCTION public.fn_audit_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_log (action, table_name, record_id, old_values, new_values, performed_by)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_activity_entries   ON public.activity_entries;
DROP TRIGGER IF EXISTS trg_audit_reporting_periods  ON public.reporting_periods;
DROP TRIGGER IF EXISTS trg_audit_anomaly_flags      ON public.anomaly_flags;
CREATE TRIGGER trg_audit_activity_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_changes();
CREATE TRIGGER trg_audit_reporting_periods
  AFTER INSERT OR UPDATE OR DELETE ON public.reporting_periods
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_changes();
CREATE TRIGGER trg_audit_anomaly_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.anomaly_flags
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_changes();

-- ---------------------------------------------------------------------------
-- 6. Emission factor auto-key trigger (migration 006)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_compute_ef_key()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.activity_key := CASE NEW.source_type
    WHEN 'stationary_combustion' THEN
      'stationary_combustion.' ||
        (SELECT code FROM public.fuel_types WHERE id = NEW.fuel_type_id)
    WHEN 'mobile_combustion' THEN
      'mobile_combustion.' ||
        (SELECT code FROM public.fuel_types WHERE id = NEW.fuel_type_id)
    WHEN 'purchased_electricity' THEN
      'purchased_electricity.' ||
        (SELECT code FROM public.grid_regions WHERE id = NEW.grid_region_id)
    WHEN 'purchased_steam' THEN 'purchased_steam.default'
    WHEN 'fugitive' THEN
      'fugitive.' ||
        (SELECT code FROM public.refrigerants WHERE id = NEW.refrigerant_id)
    ELSE 'unknown.' || NEW.source_type
  END;
  NEW.set_id      := NEW.source_db;
  NEW.set_version := CASE NEW.source_db
    WHEN 'DEFRA_2024' THEN '2024'
    WHEN 'IPCC_AR6'   THEN '6'
    WHEN 'MINEM_2023' THEN '2023'
    ELSE '1'
  END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ef_key ON public.emission_factors;
CREATE TRIGGER trg_ef_key
  BEFORE INSERT OR UPDATE ON public.emission_factors
  FOR EACH ROW EXECUTE FUNCTION public.fn_compute_ef_key();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security — enable + real policies (migration 005 + 007)
-- ---------------------------------------------------------------------------
ALTER TABLE public.fuel_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refrigerants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grid_regions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_flags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports    ENABLE ROW LEVEL SECURITY;

-- Tablas de referencia: lectura pública
DROP POLICY IF EXISTS "ref_read_all"   ON public.fuel_types;
DROP POLICY IF EXISTS "ref_read_all"   ON public.refrigerants;
DROP POLICY IF EXISTS "ref_read_all"   ON public.grid_regions;
DROP POLICY IF EXISTS "ref_read_all"   ON public.emission_factors;
DROP POLICY IF EXISTS "ref_read_all"   ON public.unit_conversions;
CREATE POLICY "ref_read_all" ON public.fuel_types       FOR SELECT USING (true);
CREATE POLICY "ref_read_all" ON public.refrigerants     FOR SELECT USING (true);
CREATE POLICY "ref_read_all" ON public.grid_regions     FOR SELECT USING (true);
CREATE POLICY "ref_read_all" ON public.emission_factors FOR SELECT USING (true);
CREATE POLICY "ref_read_all" ON public.unit_conversions FOR SELECT USING (true);

-- Funciones de ayuda para RLS
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

-- Organizaciones
DROP POLICY IF EXISTS "org_select" ON public.organizations;
DROP POLICY IF EXISTS "org_insert" ON public.organizations;
DROP POLICY IF EXISTS "org_update" ON public.organizations;
CREATE POLICY "org_select" ON public.organizations FOR SELECT
  USING (public.fn_is_org_member(id));
CREATE POLICY "org_insert" ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "org_update" ON public.organizations FOR UPDATE
  USING (public.fn_user_role_in_org(id) = 'admin')
  WITH CHECK (public.fn_user_role_in_org(id) = 'admin');

-- Proveedores
DROP POLICY IF EXISTS "supplier_select" ON public.suppliers;
DROP POLICY IF EXISTS "supplier_insert" ON public.suppliers;
DROP POLICY IF EXISTS "supplier_update" ON public.suppliers;
CREATE POLICY "supplier_select" ON public.suppliers FOR SELECT
  USING (public.fn_is_org_member(organization_id));
CREATE POLICY "supplier_insert" ON public.suppliers FOR INSERT
  WITH CHECK (public.fn_user_role_in_org(organization_id) IN ('admin', 'consultant'));
CREATE POLICY "supplier_update" ON public.suppliers FOR UPDATE
  USING (public.fn_user_role_in_org(organization_id) IN ('admin', 'consultant'))
  WITH CHECK (public.fn_user_role_in_org(organization_id) IN ('admin', 'consultant'));

-- Membresías
DROP POLICY IF EXISTS "membership_own"       ON public.memberships;
DROP POLICY IF EXISTS "membership_org_admin" ON public.memberships;
DROP POLICY IF EXISTS "membership_insert"    ON public.memberships;
CREATE POLICY "membership_own" ON public.memberships FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "membership_org_admin" ON public.memberships FOR SELECT
  USING (public.fn_user_role_in_org(organization_id) = 'admin');
CREATE POLICY "membership_insert" ON public.memberships FOR INSERT
  WITH CHECK (
    public.fn_user_role_in_org(organization_id) = 'admin'
    OR auth.uid() = user_id
  );

-- Periodos de reporte
DROP POLICY IF EXISTS "period_select" ON public.reporting_periods;
DROP POLICY IF EXISTS "period_insert" ON public.reporting_periods;
DROP POLICY IF EXISTS "period_update" ON public.reporting_periods;
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

-- Entradas de actividad
DROP POLICY IF EXISTS "activity_select"          ON public.activity_entries;
DROP POLICY IF EXISTS "activity_insert_supplier" ON public.activity_entries;
DROP POLICY IF EXISTS "activity_insert_staff"    ON public.activity_entries;
DROP POLICY IF EXISTS "activity_update_staff"    ON public.activity_entries;
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

-- Resultados de emisiones
DROP POLICY IF EXISTS "emission_result_select" ON public.emission_results;
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

-- Archivos de evidencia
DROP POLICY IF EXISTS "evidence_select" ON public.evidence_files;
DROP POLICY IF EXISTS "evidence_insert" ON public.evidence_files;
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

-- Marcadores de anomalías
DROP POLICY IF EXISTS "anomaly_select" ON public.anomaly_flags;
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

-- Registro de auditoría
DROP POLICY IF EXISTS "audit_log_read"              ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_phase1"     ON public.audit_log;
CREATE POLICY "audit_log_read" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "audit_log_insert_phase1" ON public.audit_log FOR INSERT WITH CHECK (true);

-- Exportaciones de reportes
DROP POLICY IF EXISTS "report_exports_read"         ON public.report_exports;
DROP POLICY IF EXISTS "report_exports_insert_phase1" ON public.report_exports;
CREATE POLICY "report_exports_read" ON public.report_exports FOR SELECT USING (true);
CREATE POLICY "report_exports_insert_phase1" ON public.report_exports FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. Seed data
-- ---------------------------------------------------------------------------
INSERT INTO public.fuel_types (id, code, label, scope, activity_kind) VALUES
  ('11111111-0001-0001-0001-000000000001', 'natural_gas', 'Natural Gas',     1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000002', 'diesel',      'Diesel',          1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000003', 'lpg',         'LPG / Propane',   1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000004', 'diesel',      'Diesel (Mobile)', 1, 'mobile_combustion'),
  ('11111111-0001-0001-0001-000000000005', 'gasoline',    'Gasoline',        1, 'mobile_combustion'),
  ('11111111-0001-0001-0001-000000000006', 'lpg',         'LPG (Mobile)',    1, 'mobile_combustion')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.refrigerants (id, code, label, gwp_ar6) VALUES
  ('22222222-0002-0002-0002-000000000001', 'R410A', 'R-410A (HFC blend)', 2088.00),
  ('22222222-0002-0002-0002-000000000002', 'R134A', 'R-134a (HFC)',       1430.00),
  ('22222222-0002-0002-0002-000000000003', 'R32',   'R-32 (HFC)',          675.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.grid_regions (id, code, label, country) VALUES
  ('33333333-0003-0003-0003-000000000001', 'SEIN_PERU',  'SEIN – Sistema Eléctrico Interconectado Nacional (Peru)', 'PE'),
  ('33333333-0003-0003-0003-000000000002', 'LATAM_AVG',  'Latin America Average Grid',                             'LATAM'),
  ('33333333-0003-0003-0003-000000000003', 'US_AVERAGE', 'US Average Grid (EPA eGRID 2023)',                       'US'),
  ('33333333-0003-0003-0003-000000000004', 'EU_AVERAGE', 'EU-27 Average Grid (IEA 2023)',                          'EU')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.emission_factors
  (id, source_type, fuel_type_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  ('44444444-0001-0001-0001-000000000001', 'stationary_combustion', '11111111-0001-0001-0001-000000000001', 0.18316000, 'kWh', 1, 'DEFRA_2024', '2024-01-01', NULL),
  ('44444444-0001-0001-0001-000000000002', 'stationary_combustion', '11111111-0001-0001-0001-000000000002', 2.51390000, 'L',   1, 'DEFRA_2024', '2024-01-01', NULL),
  ('44444444-0001-0001-0001-000000000003', 'stationary_combustion', '11111111-0001-0001-0001-000000000003', 1.55540000, 'L',   1, 'DEFRA_2024', '2024-01-01', NULL),
  ('44444444-0001-0002-0001-000000000001', 'mobile_combustion',     '11111111-0001-0001-0001-000000000004', 2.51390000, 'L',   1, 'DEFRA_2024', '2024-01-01', NULL),
  ('44444444-0001-0002-0001-000000000002', 'mobile_combustion',     '11111111-0001-0001-0001-000000000005', 2.16850000, 'L',   1, 'DEFRA_2024', '2024-01-01', NULL),
  ('44444444-0001-0002-0001-000000000003', 'mobile_combustion',     '11111111-0001-0001-0001-000000000006', 1.55540000, 'L',   1, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.emission_factors
  (id, source_type, grid_region_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  ('44444444-0002-0001-0001-000000000001', 'purchased_electricity', '33333333-0003-0003-0003-000000000001', 0.45170000, 'kWh', 2, 'MINEM_2023', '2023-01-01', NULL),
  ('44444444-0002-0001-0001-000000000002', 'purchased_electricity', '33333333-0003-0003-0003-000000000002', 0.28300000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL),
  ('44444444-0002-0001-0001-000000000003', 'purchased_electricity', '33333333-0003-0003-0003-000000000003', 0.38610000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL),
  ('44444444-0002-0001-0001-000000000004', 'purchased_electricity', '33333333-0003-0003-0003-000000000004', 0.23300000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.emission_factors
  (id, source_type, refrigerant_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  ('44444444-0003-0001-0001-000000000001', 'fugitive', '22222222-0002-0002-0002-000000000001', 2088.00000000, 'kg', 1, 'IPCC_AR6', '2023-01-01', NULL),
  ('44444444-0003-0001-0001-000000000002', 'fugitive', '22222222-0002-0002-0002-000000000002', 1430.00000000, 'kg', 1, 'IPCC_AR6', '2023-01-01', NULL),
  ('44444444-0003-0001-0001-000000000003', 'fugitive', '22222222-0002-0002-0002-000000000003',  675.00000000, 'kg', 1, 'IPCC_AR6', '2023-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.emission_factors
  (id, source_type, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  ('44444444-0004-0001-0001-000000000001', 'purchased_steam', 0.18400000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.unit_conversions (from_unit, to_unit, factor, notes) VALUES
  ('gallon',     'L',    3.78541200, 'US liquid gallon to litre'),
  ('gal',        'L',    3.78541200, 'US liquid gallon (abbrev) to litre'),
  ('imp_gallon', 'L',    4.54609000, 'Imperial gallon to litre'),
  ('therms',     'kWh', 29.30710000, 'US natural gas therm to kWh'),
  ('therm',      'kWh', 29.30710000, 'Singular form'),
  ('MMBtu',      'kWh', 293.07100000,'Million BTU to kWh'),
  ('MBtu',       'kWh',   0.29307100,'Thousand BTU to kWh'),
  ('BTU',        'kWh',   0.00029307,'BTU to kWh'),
  ('MWh',        'kWh', 1000.0000000,'Megawatt-hour to kilowatt-hour'),
  ('GJ',         'kWh',  277.7778000,'Gigajoule to kWh'),
  ('MJ',         'kWh',    0.2777780,'Megajoule to kWh'),
  ('kJ',         'kWh',    0.0002778,'Kilojoule to kWh'),
  ('m3_ng',      'kWh',  10.5500000, 'Cubic metre natural gas to kWh'),
  ('ft3_ng',     'kWh',   0.2988000, 'Cubic foot natural gas to kWh'),
  ('tonne',      'kg',  1000.0000000,'Metric tonne to kilogram'),
  ('lb',         'kg',     0.4535924,'Pound to kilogram'),
  ('oz',         'kg',     0.0283495,'Ounce to kilogram'),
  ('kg_lpg',     'L',      1.9646000,'Kilogram of LPG (propane) to litre'),
  ('kWh',        'kWh',    1.0000000,'Identity'),
  ('L',          'L',      1.0000000,'Identity'),
  ('kg',         'kg',     1.0000000,'Identity')
ON CONFLICT (from_unit, to_unit) DO NOTHING;

INSERT INTO public.organizations (id, name, industry, ruc, country) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'EcoGroup SAC',      'Consumer Goods',     '20612345678', 'PE'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'Andean Mining Corp', 'Mining & Extraction','20698765432', 'PE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (id, organization_id, name, category, contact_email) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'Lima Printing & Packaging SAC', 'Manufacturing',               'sustainability@limaprinting.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'Logística TransAndes',          'Transportation & Logistics',  'ops@transandes.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'Aromas del Pacífico SAC',       'Food & Beverage',             'esg@aromas.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'Equipos Mineros del Sur',       'Heavy Equipment',             'contact@equipossur.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'Servicios Eléctricos Andinos',  'Energy Services',             'operations@sea.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'Químicos Industriales SA',      'Chemicals',                   'compliance@quimicos.pe')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.reporting_periods (id, supplier_id, label, start_date, end_date, status) VALUES
  ('cccccccc-cccc-cccc-cccc-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'Q1-2026', '2026-01-01', '2026-03-31', 'under_review'),
  ('cccccccc-cccc-cccc-cccc-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  ('cccccccc-cccc-cccc-cccc-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000006', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  ('cccccccc-cccc-cccc-cccc-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000008', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  ('cccccccc-cccc-cccc-cccc-000000000009', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000010', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  ('cccccccc-cccc-cccc-cccc-000000000011', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000006', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000012', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000006', 'Q1-2026', '2026-01-01', '2026-03-31', 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_entries
  (id, reporting_period_id, source_type, activity_kind, raw_quantity, raw_unit,
   fuel_type_id, grid_region_id, status, submitted_at)
VALUES
  ('dddddddd-dddd-dddd-dddd-000000000001', 'cccccccc-cccc-cccc-cccc-000000000001', 'stationary_combustion',  '{"kind":"stationary_combustion","fuel":"diesel"}'::jsonb,          850.0, 'L',   '11111111-0001-0001-0001-000000000002', NULL,                                   'validated', '2026-01-15 09:00:00+00'),
  ('dddddddd-dddd-dddd-dddd-000000000002', 'cccccccc-cccc-cccc-cccc-000000000001', 'purchased_electricity',  '{"kind":"purchased_electricity","gridRegion":"SEIN_PERU"}'::jsonb, 42500.0,'kWh', NULL,                                   '33333333-0003-0003-0003-000000000001', 'validated', '2026-01-15 09:00:00+00'),
  ('dddddddd-dddd-dddd-dddd-000000000003', 'cccccccc-cccc-cccc-cccc-000000000003', 'mobile_combustion',       '{"kind":"mobile_combustion","fuel":"diesel"}'::jsonb,             12400.0,'L',   '11111111-0001-0001-0001-000000000004', NULL,                                   'validated', '2026-01-14 10:00:00+00'),
  ('dddddddd-dddd-dddd-dddd-000000000004', 'cccccccc-cccc-cccc-cccc-000000000003', 'mobile_combustion',       '{"kind":"mobile_combustion","fuel":"gasoline"}'::jsonb,           3200.0, 'L',   '11111111-0001-0001-0001-000000000005', NULL,                                   'validated', '2026-01-14 10:00:00+00'),
  ('dddddddd-dddd-dddd-dddd-000000000005', 'cccccccc-cccc-cccc-cccc-000000000005', 'stationary_combustion',  '{"kind":"stationary_combustion","fuel":"lpg"}'::jsonb,             920.0, 'L',   '11111111-0001-0001-0001-000000000003', NULL,                                   'validated', '2026-01-16 11:00:00+00'),
  ('dddddddd-dddd-dddd-dddd-000000000006', 'cccccccc-cccc-cccc-cccc-000000000005', 'purchased_electricity',  '{"kind":"purchased_electricity","gridRegion":"SEIN_PERU"}'::jsonb, 28700.0,'kWh', NULL,                                   '33333333-0003-0003-0003-000000000001', 'validated', '2026-01-16 11:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_entries
  (id, reporting_period_id, source_type, activity_kind, raw_quantity, raw_unit,
   fuel_type_id, grid_region_id, status, submitted_at, notes)
VALUES
  ('dddddddd-dddd-dddd-dddd-000000000007', 'cccccccc-cccc-cccc-cccc-000000000002', 'stationary_combustion', '{"kind":"stationary_combustion","fuel":"diesel"}'::jsonb,          4750.0, 'L',    '11111111-0001-0001-0001-000000000002', NULL,                                   'submitted', '2026-04-05 14:30:00+00', 'Reported by new procurement team. Unverified.'),
  ('dddddddd-dddd-dddd-dddd-000000000008', 'cccccccc-cccc-cccc-cccc-000000000002', 'purchased_electricity', '{"kind":"purchased_electricity","gridRegion":"SEIN_PERU"}'::jsonb, 44100.0, 'kWh',  NULL,                                   '33333333-0003-0003-0003-000000000001', 'submitted', '2026-04-05 14:30:00+00', NULL),
  ('dddddddd-dddd-dddd-dddd-000000000009', 'cccccccc-cccc-cccc-cccc-000000000004', 'mobile_combustion',     '{"kind":"mobile_combustion","fuel":"diesel"}'::jsonb,             11800.0, 'L',    '11111111-0001-0001-0001-000000000004', NULL,                                   'submitted', '2026-04-03 08:00:00+00', NULL),
  ('dddddddd-dddd-dddd-dddd-000000000010', 'cccccccc-cccc-cccc-cccc-000000000006', 'stationary_combustion', '{"kind":"stationary_combustion","fuel":"lpg"}'::jsonb,              880.0, 'L',    '11111111-0001-0001-0001-000000000003', NULL,                                   'draft',     NULL,                      NULL)
ON CONFLICT (id) DO NOTHING;

-- Deshabilitar triggers de auditoría temporalmente para que las inserciones semilla no generen filas de auditoría en periodos bloqueados
ALTER TABLE public.activity_entries  DISABLE TRIGGER trg_audit_activity_entries;
ALTER TABLE public.reporting_periods DISABLE TRIGGER trg_audit_reporting_periods;

INSERT INTO public.emission_results
  (id, activity_entry_id, reporting_period_id, scope, co2e_kg,
   factor_used, factor_unit, normalized_quantity, normalized_unit,
   calc_hash, calc_version, emission_factor_id, calculated_at)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-000000000001', 'dddddddd-dddd-dddd-dddd-000000000001', 'cccccccc-cccc-cccc-cccc-000000000001', 1,  2136.815000, 2.51390000, 'kg_co2e_per_L',   850.0,  'L',   'seed_hash_lp_q4_diesel_001', '0.0.0-seed', '44444444-0001-0001-0001-000000000002', '2026-01-20 00:00:00+00'),
  ('eeeeeeee-eeee-eeee-eeee-000000000002', 'dddddddd-dddd-dddd-dddd-000000000002', 'cccccccc-cccc-cccc-cccc-000000000001', 2, 19197.250000, 0.45170000, 'kg_co2e_per_kWh', 42500.0,'kWh', 'seed_hash_lp_q4_elec_002',   '0.0.0-seed', '44444444-0002-0001-0001-000000000001', '2026-01-20 00:00:00+00'),
  ('eeeeeeee-eeee-eeee-eeee-000000000003', 'dddddddd-dddd-dddd-dddd-000000000003', 'cccccccc-cccc-cccc-cccc-000000000003', 1, 31172.360000, 2.51390000, 'kg_co2e_per_L',   12400.0,'L',   'seed_hash_ta_q4_diesel_003', '0.0.0-seed', '44444444-0001-0002-0001-000000000001', '2026-01-20 00:00:00+00'),
  ('eeeeeeee-eeee-eeee-eeee-000000000004', 'dddddddd-dddd-dddd-dddd-000000000004', 'cccccccc-cccc-cccc-cccc-000000000003', 1,  6939.200000, 2.16850000, 'kg_co2e_per_L',   3200.0, 'L',   'seed_hash_ta_q4_gasoline_004','0.0.0-seed', '44444444-0001-0002-0001-000000000002', '2026-01-20 00:00:00+00'),
  ('eeeeeeee-eeee-eeee-eeee-000000000005', 'dddddddd-dddd-dddd-dddd-000000000005', 'cccccccc-cccc-cccc-cccc-000000000005', 1,  1430.968000, 1.55540000, 'kg_co2e_per_L',   920.0,  'L',   'seed_hash_ar_q4_lpg_005',    '0.0.0-seed', '44444444-0001-0001-0001-000000000003', '2026-01-20 00:00:00+00'),
  ('eeeeeeee-eeee-eeee-eeee-000000000006', 'dddddddd-dddd-dddd-dddd-000000000006', 'cccccccc-cccc-cccc-cccc-000000000005', 2, 12963.790000, 0.45170000, 'kg_co2e_per_kWh', 28700.0,'kWh', 'seed_hash_ar_q4_elec_006',   '0.0.0-seed', '44444444-0002-0001-0001-000000000001', '2026-01-20 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.activity_entries  ENABLE TRIGGER trg_audit_activity_entries;
ALTER TABLE public.reporting_periods ENABLE TRIGGER trg_audit_reporting_periods;

INSERT INTO public.anomaly_flags
  (id, activity_entry_id, detector, severity, z_score, threshold_used, message, is_resolved, flagged_at)
VALUES
  ('ffffffff-ffff-ffff-ffff-000000000001',
   'dddddddd-dddd-dddd-dddd-000000000007',
   'zscore_monthly', 'high', 45.88, 3.00,
   'Diesel consumption of 4,750 L in Q1-2026 is 45.9σ above the Q4-2025 baseline of 850 L. Verify invoices — possible data entry error.',
   false, '2026-04-05 14:31:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_log (id, action, table_name, record_id, new_values, performed_at)
VALUES
  ('99999999-aaaa-aaaa-aaaa-000000000001', 'LOCK', 'reporting_periods', 'cccccccc-cccc-cccc-cccc-000000000001', '{"status":"locked","label":"Q4-2025","supplier":"Lima Printing & Packaging SAC"}'::jsonb, '2026-02-10 16:00:00+00'),
  ('99999999-aaaa-aaaa-aaaa-000000000002', 'LOCK', 'reporting_periods', 'cccccccc-cccc-cccc-cccc-000000000003', '{"status":"locked","label":"Q4-2025","supplier":"Logística TransAndes"}'::jsonb,          '2026-02-10 16:05:00+00'),
  ('99999999-aaaa-aaaa-aaaa-000000000003', 'LOCK', 'reporting_periods', 'cccccccc-cccc-cccc-cccc-000000000005', '{"status":"locked","label":"Q4-2025","supplier":"Aromas del Pacífico SAC"}'::jsonb,       '2026-02-10 16:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Demo auth user + memberships
-- email: admin@earthlink.test  |  password: Earthlink2025!
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@earthlink.test';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, aud, role, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000999',
      '00000000-0000-0000-0000-000000000000',
      'admin@earthlink.test',
      extensions.crypt('Earthlink2025!', extensions.gen_salt('bf')),
      now(), 'authenticated', 'authenticated', now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false
    );
    v_user_id := '00000000-0000-0000-0000-000000000999';
  END IF;

  INSERT INTO public.memberships (user_id, organization_id, supplier_id, role)
  VALUES
    (v_user_id, 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', NULL, 'admin'),
    (v_user_id, 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', NULL, 'admin')
  ON CONFLICT DO NOTHING;
END $$;
