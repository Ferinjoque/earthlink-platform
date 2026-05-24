-- Migración 014: Agregar resolution_note a anomaly_flags
-- Permite a los auditores registrar el motivo al resolver una anomalía.

ALTER TABLE public.anomaly_flags
  ADD COLUMN IF NOT EXISTS resolution_note text;

COMMENT ON COLUMN public.anomaly_flags.resolution_note IS 'Nota opcional de texto libre que explica por qué se resolvió o descartó la anomalía.';
