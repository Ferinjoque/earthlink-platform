# EarthLink — ESG Carbon Auditor

> **Automated GHG accounting for Scope 1 & 2 emissions.** Turn spreadsheet chaos into an auditable, immutable carbon ledger.

[![CI](https://github.com/Ferinjoque/esg-supplier-auditor/actions/workflows/ci.yml/badge.svg)](https://github.com/Ferinjoque/esg-supplier-auditor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What it does

EarthLink replaces manual Excel-based carbon accounting with a deterministic, fully auditable platform. Suppliers submit activity data (fuel consumption, electricity purchases) through a guided interface; a pure functional calculation engine converts raw inputs to tCO₂e using versioned emission factors; consultants audit the results and generate regulator-ready reports.

Every tCO₂e reported traces back — immutably — to the raw submission, the emission factor version, the calculation engine version, and the user who submitted it.

## Architecture

The system deliberately uses **two programming paradigms** in clearly separated modules:

```
app/               Next.js 15 App Router (thin layer)
  │
services/          OOP — orchestration services
  ├──→ repos/      OOP — abstract Repository<T> + Supabase concretes
  │     └──→ Supabase (Postgres + RLS + Storage)
  └──→ calc/       PURE FP — no side effects, no I/O
domain/            OOP — EmissionSource hierarchy, value objects
```

### OOP layer (`domain/`, `repos/`, `services/`)

- `abstract EmissionSource` with concrete `StationaryCombustionSource`, `MobileCombustionSource`, `PurchasedElectricitySource`, `PurchasedSteamSource`, `FugitiveEmissionSource`
- `abstract Repository<TEntity, TId>` with `SupabaseRepository<T>` and `InMemoryRepository<T>` (used in tests)
- Polymorphism: `source.validate(raw)` and `source.factorKey()` called without type switching

### FP engine (`calc/`)

- Discriminated union `ActivityKind` covers all Scope 1 + 2 activity types
- Pure pipeline: `validateActivity → normalizeUnit → resolveFactor → applyFactor → stampProvenance`
- Determinism: `big.js` fixed-point arithmetic, single final rounding, `calcHash = sha256(canonical(inputs))`
- Factor-set versioning: results store `factorSetVersion`; new factor sets produce new result rows linked via `superseded_by`
- ESLint boundary rule enforces zero I/O imports in `calc/`

## Database — 15 tables

| Group | Tables |
|---|---|
| Reference (5) | `organizations`, `suppliers`, `emission_factor_sets`, `emission_factors`, `unit_conversions` |
| Auth/Access (3) | `user_profiles`, `memberships`, `supplier_assignments` |
| Transactional (5) | `reporting_periods`, `activity_records`, `emission_results`*, `evaluations`, `anomaly_flags` |
| Audit (2) | `audit_log`*, `report_exports`* |

\* Append-only — `UPDATE` / `DELETE` revoked at DB level. Audit log is trigger-populated.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript 5 (strict + noUncheckedIndexedAccess) |
| Database | Supabase (Postgres + Auth + Storage + RLS) |
| Styling | Tailwind v4 + OKLCH design tokens |
| Animation | Framer Motion |
| Validation | Zod |
| Arithmetic | big.js (fixed-point, 6 dp) |
| Unit tests | Vitest + fast-check (property-based) |
| E2E tests | Playwright (chromium + firefox + webkit) |
| CI | GitHub Actions |
| Deploy | Vercel (free) + Supabase (free) |

## Getting started

```bash
# Prerequisites: Node 22+, pnpm 9+

pnpm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

pnpm dev        # http://localhost:3000
pnpm test       # unit tests
pnpm test:e2e   # playwright (starts dev server automatically)
```

### Supabase setup

```bash
# Apply migrations + seed
supabase db reset
```

## Project structure

```
src/
├── calc/          Pure FP engine — zero I/O
├── domain/        OOP entities + value objects
├── repos/         OOP repositories (Supabase + InMemory)
├── services/      Orchestration services
├── components/    React components
│   ├── ui/        Design system primitives
│   ├── app/       Feature components
│   └── charts/    visx-based charts
├── lib/           Cross-cutting (auth, zod schemas, logger, csp)
├── styles/        Tailwind v4 tokens, typography
└── types/         Shared TypeScript types
app/               Next.js App Router
supabase/
├── migrations/    Forward-only SQL (15 tables)
└── seed/          Emission factors + demo data
tests/
├── unit/          Vitest
└── e2e/           Playwright
docs/
├── adr/           Architecture Decision Records
└── uml/           Class + sequence diagrams
```

## GHG Protocol scope

- **Scope 1**: Stationary combustion (natural gas, diesel, LPG), mobile combustion (fleet fuel), fugitive emissions (refrigerants)
- **Scope 2**: Purchased electricity (location-based), purchased steam
- **Scope 3**: Explicitly out of scope

## License

MIT — see [LICENSE](LICENSE)
