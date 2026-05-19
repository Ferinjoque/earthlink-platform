-- Migration 020: data_quality field on activity_entries
-- GHG Protocol requires distinguishing measured vs estimated vs calculated values.
-- This field enables quality reporting (% measured vs estimated) and affects
-- anomaly detection confidence.

ALTER TABLE activity_entries
  ADD COLUMN IF NOT EXISTS data_quality text
    DEFAULT 'measured'
    CHECK (data_quality IN ('measured', 'estimated', 'calculated'));

COMMENT ON COLUMN activity_entries.data_quality IS
  'How the raw_quantity was obtained: measured (direct meter/invoice), estimated (proxy/interpolation), calculated (derived from other data)';

-- Backfill: existing entries are assumed measured
UPDATE activity_entries SET data_quality = 'measured' WHERE data_quality IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE activity_entries ALTER COLUMN data_quality SET NOT NULL;
ALTER TABLE activity_entries ALTER COLUMN data_quality SET DEFAULT 'measured';
