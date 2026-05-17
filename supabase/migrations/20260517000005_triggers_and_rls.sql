-- =============================================================================
-- Migration 005: Triggers, Append-Only Guards, Auto-Audit, and RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Append-only mutation guard
-- Blocks UPDATE and DELETE on emission_results, audit_log, report_exports.
-- Defense-in-depth: RLS alone is insufficient since service_role bypasses it.
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

-- emission_results
CREATE TRIGGER trg_emission_results_no_update
  BEFORE UPDATE ON public.emission_results
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

CREATE TRIGGER trg_emission_results_no_delete
  BEFORE DELETE ON public.emission_results
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

-- audit_log
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

-- report_exports
CREATE TRIGGER trg_report_exports_no_update
  BEFORE UPDATE ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

CREATE TRIGGER trg_report_exports_no_delete
  BEFORE DELETE ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_mutation();

-- ---------------------------------------------------------------------------
-- Auto-audit trigger
-- Writes a row to audit_log whenever activity_entries or reporting_periods
-- are mutated. Runs as SECURITY DEFINER so it can always insert to audit_log.
-- ---------------------------------------------------------------------------
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
-- Row Level Security
-- Phase 1: open policies (no auth yet — tightened in Phase 4 feat/phase-4-auth-rls).
-- All tables have RLS enabled so the policies are ready to swap.
-- ---------------------------------------------------------------------------

-- Reference tables: public read, no write from client
ALTER TABLE public.fuel_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refrigerants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grid_regions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_read_all"  ON public.fuel_types       FOR SELECT USING (true);
CREATE POLICY "ref_read_all"  ON public.refrigerants     FOR SELECT USING (true);
CREATE POLICY "ref_read_all"  ON public.grid_regions     FOR SELECT USING (true);
CREATE POLICY "ref_read_all"  ON public.emission_factors FOR SELECT USING (true);
CREATE POLICY "ref_read_all"  ON public.unit_conversions FOR SELECT USING (true);

-- Access tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships   ENABLE ROW LEVEL SECURITY;

-- Phase 1 open policy — replaced in Phase 4
CREATE POLICY "phase1_open" ON public.organizations USING (true) WITH CHECK (true);
CREATE POLICY "phase1_open" ON public.suppliers     USING (true) WITH CHECK (true);
CREATE POLICY "phase1_open" ON public.memberships   USING (true) WITH CHECK (true);

-- Transactional tables
ALTER TABLE public.reporting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_flags     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase1_open" ON public.reporting_periods USING (true) WITH CHECK (true);
CREATE POLICY "phase1_open" ON public.activity_entries  USING (true) WITH CHECK (true);
CREATE POLICY "phase1_open" ON public.emission_results  USING (true) WITH CHECK (true);
CREATE POLICY "phase1_open" ON public.evidence_files    USING (true) WITH CHECK (true);
CREATE POLICY "phase1_open" ON public.anomaly_flags     USING (true) WITH CHECK (true);

-- Audit tables: SELECT only from client; INSERT via SECURITY DEFINER trigger only
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_read"      ON public.audit_log      FOR SELECT USING (true);
CREATE POLICY "report_exports_read" ON public.report_exports FOR SELECT USING (true);
-- Phase 1: allow anon insert for seeding (locked down in Phase 4)
CREATE POLICY "audit_log_insert_phase1"      ON public.audit_log      FOR INSERT WITH CHECK (true);
CREATE POLICY "report_exports_insert_phase1" ON public.report_exports FOR INSERT WITH CHECK (true);
