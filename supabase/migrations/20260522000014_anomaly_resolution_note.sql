-- Migration 014: Add resolution_note to anomaly_flags
-- Allows auditors to record the reason when resolving an anomaly.

ALTER TABLE public.anomaly_flags
  ADD COLUMN IF NOT EXISTS resolution_note text;

COMMENT ON COLUMN public.anomaly_flags.resolution_note IS 'Optional free-text note explaining why the anomaly was resolved or dismissed.';
