# Supabase Migrations

Forward-only migration files. Never edit existing files — add new ones.

## Applying locally

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase stack (requires Docker)
supabase start

# Apply all migrations + seed
supabase db reset
```

## Applying to remote project

```bash
# Link to your Supabase project
supabase link --project-ref <project-ref>

# Push migrations
supabase db push
```

## Migration index

| File | Tables created |
|------|----------------|
| `20260517000001_reference_tables.sql` | `fuel_types`, `refrigerants`, `grid_regions`, `emission_factors`, `unit_conversions` |
| `20260517000002_access_tables.sql` | `organizations`, `suppliers`, `memberships` + `fn_set_updated_at` |
| `20260517000003_transactional_tables.sql` | `reporting_periods`, `activity_entries`, `emission_results`, `evidence_files`, `anomaly_flags` |
| `20260517000004_audit_tables.sql` | `audit_log`, `report_exports` |
| `20260517000005_triggers_and_rls.sql` | Append-only guards, auto-audit triggers, Phase 1 RLS |

## Generating TypeScript types

After any schema change, regenerate `src/types/database.ts`:

```bash
supabase gen types typescript --local > src/types/database.ts
```
