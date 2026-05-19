-- ── Correction flow: void entries + unlock periods ───────────────────────────
-- activity_entries: soft-delete via voided_at (UPDATE allowed, no trigger blocks it)
ALTER TABLE activity_entries
  ADD COLUMN IF NOT EXISTS voided_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason     TEXT,
  ADD COLUMN IF NOT EXISTS voided_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS corrects_entry_id UUID REFERENCES activity_entries(id);

-- reporting_periods: track unlock history for locked → under_review transitions
ALTER TABLE reporting_periods
  ADD COLUMN IF NOT EXISTS unlocked_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlock_reason   TEXT,
  ADD COLUMN IF NOT EXISTS unlocked_by     UUID REFERENCES auth.users(id);

-- Index for fast lookup of active (non-voided) entries per period
CREATE INDEX IF NOT EXISTS idx_activity_entries_active
  ON activity_entries (reporting_period_id)
  WHERE voided_at IS NULL;
