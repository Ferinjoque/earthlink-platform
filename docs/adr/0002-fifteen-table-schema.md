# ADR-0002: 15-Table Relational Schema

**Status:** Accepted  
**Date:** 2026-05-17  
**Authors:** EarthLink Engineering Team

---

## Context

The project rubric mandates exactly 15 relational tables. The original 4-table schema (`companies`, `suppliers`, `emission_factors`, `environmental_evaluations`) was insufficient to model:

- Factor versioning (auditors need to know *which* version of IPCC AR6 was used for a given calculation)
- Append-only immutable audit trail (required by GHG Protocol assurance level)
- Multi-tenant access control with role granularity (supplier vs. consultant vs. admin)
- Anomaly detection state
- Report export provenance

## Decision

Fifteen tables organized in four groups:

### Reference / Master (5) — read-mostly, admin-managed

| Table | Purpose |
|---|---|
| `organizations` | Tenant root — the EarthLink client firm |
| `suppliers` | Supplier accounts attached to an org |
| `emission_factor_sets` | Versioned sets (IPCC AR6 2023, DEFRA 2024, Peru Grid) |
| `emission_factors` | One row per `(set_id, activity_type, region, unit)` — immutable per set |
| `unit_conversions` | Canonical conversion ratios (gallon→litre, MWh→kWh) — seeded, read-only at runtime |

### Auth / Access (3)

| Table | Purpose |
|---|---|
| `user_profiles` | 1:1 with `auth.users`; display name, default org |
| `memberships` | `(user_id, org_id, role)` — drives all RLS policies |
| `supplier_assignments` | `(consultant_user_id, supplier_id)` — limits which auditor sees which supplier |

### Transactional (5) — the operational core

| Table | Purpose |
|---|---|
| `reporting_periods` | `(supplier_id, label, start, end, status)` e.g. Q1-2026 |
| `activity_records` | Raw supplier inputs — one row per submission item |
| `emission_results` | Calc engine output — **append-only**, `superseded_by` link for recalcs |
| `evaluations` | Auditor verdict bundle per period — status machine: `pending → calculated → under_review → locked` |
| `anomaly_flags` | Z-score anomaly records generated on submission |

### Audit (2) — append-only, immutable

| Table | Purpose |
|---|---|
| `audit_log` | Every domain mutation, trigger-populated. `UPDATE`/`DELETE` revoked at Postgres role level |
| `report_exports` | PDF/CSV metadata + Storage path + sha256 |

## Immutability enforcement

For `emission_results`, `audit_log`, and `report_exports`:
- `REVOKE UPDATE, DELETE ON TABLE ... FROM authenticated, anon`
- `BEFORE UPDATE OR DELETE` trigger raises exception as belt-and-suspenders

## Consequences

- 15 tables satisfies the rubric requirement.
- Factor versioning is first-class: `emission_results.factor_set_id` + `emission_results.factor_set_version` form a permanent provenance link.
- The audit log provides the "immutable receipt" that GHG Protocol assurance requires — every mutation is recorded with actor, timestamp, before/after JSON.
- Multi-tenant isolation via `memberships` + RLS means a single Supabase project serves multiple organizations without row leakage.
