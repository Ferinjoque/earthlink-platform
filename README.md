# EarthLink — ESG Carbon Auditor

> **Automated GHG accounting for Scope 1 & 2 emissions.** Turn spreadsheet chaos into an auditable, immutable carbon ledger.

[![CI](https://github.com/Ferinjoque/esg-supplier-auditor/actions/workflows/ci.yml/badge.svg)](https://github.com/Ferinjoque/esg-supplier-auditor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What it does

EarthLink replaces manual Excel-based carbon accounting with a deterministic, fully auditable platform. Suppliers submit activity data (fuel consumption, electricity purchases) through a guided interface; a pure functional calculation engine converts raw inputs to tCO₂e using versioned emission factors; consultants audit the results and lock periods for regulatory reporting.

Every tCO₂e reported traces back — immutably — to the raw submission, the emission factor version, the calculation engine version, and the user who submitted it.

## Architecture

The system deliberately uses **two programming paradigms** in clearly separated modules:

```
src/app/           Next.js App Router (thin layer)
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
- ESLint boundary rule enforces zero I/O imports in `calc/`

## Database — 15 tables

| Group | Tables |
|---|---|
| Reference (5) | `fuel_types`, `refrigerants`, `grid_regions`, `emission_factors`, `unit_conversions` |
| Auth/Access (3) | `organizations`, `suppliers`, `memberships` |
| Transactional (5) | `reporting_periods`, `activity_entries`, `emission_results`*, `evidence_files`, `anomaly_flags` |
| Audit (2) | `audit_log`*, `report_exports`* |

\* Append-only — `UPDATE` / `DELETE` blocked by DB triggers. Audit log is trigger-populated.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 (strict + noUncheckedIndexedAccess) |
| Database | Supabase (Postgres + Auth + RLS) |
| Styling | CSS custom properties (OKLCH tokens) — no Tailwind classes for layout/color |
| Animation | Framer Motion + canvas requestAnimationFrame |
| Validation | Zod (in Server Actions) |
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
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

pnpm dev        # http://localhost:3002 (3000 reserved for other project)
pnpm test       # unit tests
pnpm test:e2e   # playwright (starts dev server automatically)
```

### Demo credentials

```
email:    admin@earthlink.test
password: Earthlink2025!
```

Admin role in both seeded organizations (EcoGroup SAC + Andean Mining Corp).

### Supabase setup

```bash
# Apply all migrations to remote project
supabase db push

# Or reset local stack
supabase db reset
```

## Project structure

```
src/
├── calc/          Pure FP engine — zero I/O
├── domain/        OOP entities + value objects
├── repos/         OOP repositories (Supabase + InMemory)
├── services/      Orchestration services (EvaluationService, AuditService, AnomalyService)
├── actions/       Server Actions (auth, activity, audit)
├── components/
│   ├── shell/     Sidebar, TopBar
│   ├── activity/  ActivityForm, ActivityList, CsvImportPanel, AnomalyBadge
│   ├── audit/     PeriodActions
│   └── ui/        Button, Card, Badge
├── lib/           csv.ts, auth utils
├── styles/        tokens.css, typography.css, globals.css
└── types/         database.ts (Supabase generated)
app/               Next.js App Router (src/app/)
supabase/
└── migrations/    Forward-only SQL — 10 migrations applied
tests/
├── unit/          Vitest
└── e2e/           Playwright
docs/
├── DESIGN.md      Living design system reference
├── adr/           Architecture Decision Records
└── uml/           Class + sequence diagrams
CLAUDE.md          AI agent context — read before any session
```

## GHG Protocol scope

- **Scope 1**: Stationary combustion (natural gas, diesel, LPG), mobile combustion (fleet fuel), fugitive emissions (refrigerants)
- **Scope 2**: Purchased electricity (location-based), purchased steam
- **Scope 3**: Explicitly out of scope

## License

MIT — see [LICENSE](LICENSE)
