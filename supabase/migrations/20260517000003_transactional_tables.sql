-- =============================================================================
-- Migración 003: Tablas transaccionales (5 tablas)
-- Datos del negocio: periodos, entradas, resultados, evidencias, anomalías
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 9. reporting_periods
-- ---------------------------------------------------------------------------
CREATE TABLE public.reporting_periods (
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

COMMENT ON TABLE  public.reporting_periods IS 'Ventana temporal de auditoría por proveedor (trimestral o anual).';
COMMENT ON COLUMN public.reporting_periods.status IS 'open → calculating → under_review → locked. Los periodos bloqueados son inmutables.';

CREATE INDEX idx_periods_supplier        ON public.reporting_periods (supplier_id);
CREATE INDEX idx_periods_supplier_status ON public.reporting_periods (supplier_id, status);

CREATE TRIGGER trg_reporting_periods_updated_at
  BEFORE UPDATE ON public.reporting_periods
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. activity_entries
-- ---------------------------------------------------------------------------
CREATE TABLE public.activity_entries (
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

COMMENT ON TABLE  public.activity_entries IS 'Datos de consumo crudo del proveedor antes del procesamiento del motor FP.';
COMMENT ON COLUMN public.activity_entries.activity_kind IS 'Unión discriminada ActivityKind serializada para entrada al motor de cálculo.';
COMMENT ON COLUMN public.activity_entries.raw_unit IS 'Unidad tal como fue enviada; el motor FP normaliza antes de aplicar el factor de emisión.';

CREATE INDEX idx_entries_period      ON public.activity_entries (reporting_period_id);
CREATE INDEX idx_entries_source_type ON public.activity_entries (source_type);
CREATE INDEX idx_entries_status      ON public.activity_entries (status);

CREATE TRIGGER trg_activity_entries_updated_at
  BEFORE UPDATE ON public.activity_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. emission_results  (SOLO-APPEND)
-- Guardia de mutación aplicada en migración 005.
-- ---------------------------------------------------------------------------
CREATE TABLE public.emission_results (
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

COMMENT ON TABLE  public.emission_results IS 'Salida determinista del motor FP. Solo-append — no se permiten UPDATE ni DELETE.';
COMMENT ON COLUMN public.emission_results.calc_hash IS 'sha256(canonical(entradas)) — proveniencia criptográfica que vincula el resultado a los parámetros de entrada.';
COMMENT ON COLUMN public.emission_results.calc_version IS 'Versión del motor de cálculo (de src/calc/version.ts) que produjo este resultado.';

CREATE INDEX idx_results_entry  ON public.emission_results (activity_entry_id);
CREATE INDEX idx_results_period ON public.emission_results (reporting_period_id);
CREATE INDEX idx_results_scope  ON public.emission_results (scope);

-- ---------------------------------------------------------------------------
-- 12. evidence_files
-- ---------------------------------------------------------------------------
CREATE TABLE public.evidence_files (
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

COMMENT ON TABLE  public.evidence_files IS 'Archivos adjuntos (facturas, lecturas de medidor) que comprueban los datos de actividad. Almacenados en Supabase Storage.';
COMMENT ON COLUMN public.evidence_files.sha256 IS 'SHA-256 hexadecimal del contenido del archivo para verificación de integridad.';

CREATE INDEX idx_evidence_entry ON public.evidence_files (activity_entry_id);

-- ---------------------------------------------------------------------------
-- 13. anomaly_flags
-- ---------------------------------------------------------------------------
CREATE TABLE public.anomaly_flags (
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

COMMENT ON TABLE  public.anomaly_flags IS 'Resultados de detección automatizada de anomalías. El seed incluye una anomalía de alta severidad para demo.';
COMMENT ON COLUMN public.anomaly_flags.z_score IS 'Desviaciones estándar respecto a la línea base del periodo; NULL para detectores basados en reglas.';

CREATE INDEX idx_anomalies_entry    ON public.anomaly_flags (activity_entry_id);
CREATE INDEX idx_anomalies_severity ON public.anomaly_flags (severity) WHERE NOT is_resolved;
