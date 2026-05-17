# ADR-0001: Multi-Paradigm Architecture (OOP + FP)

**Status:** Accepted  
**Date:** 2026-05-17  
**Authors:** EarthLink Engineering Team

---

## Context

The system must simultaneously:

1. Model a rich domain of organizations, suppliers, evaluation periods, and role-gated access — entities with identity, lifecycle, and complex relationships.
2. Execute carbon calculations that must be deterministic, testable in isolation, and traceable to specific inputs and factor versions for audit purposes.

A purely OOP approach would mix I/O-laden infrastructure code with arithmetic logic, making the calculation engine impossible to test without a database fixture. A purely functional approach would make domain lifecycle management (status transitions, audit trail writes) awkward and non-idiomatic in TypeScript.

## Decision

Split the system along a clean seam:

| Paradigm | Owns | Rationale |
|---|---|---|
| **OOP** | `domain/`, `repos/`, `services/` | Entities have identity, mutable lifecycle state, and side effects (DB writes, audit log). Inheritance and polymorphism model the `EmissionSource` hierarchy naturally. Repository pattern enables test doubles. |
| **Pure FP** | `calc/` | Carbon arithmetic must be deterministic, side-effect-free, and independently testable. Pure functions compose, property-test, and replay trivially. `calcHash = sha256(canonical(inputs))` proves that a specific result came from specific inputs — impossible to guarantee with stateful OOP. |

The seam is enforced by an ESLint `boundaries` rule: no file under `src/calc/` may import from `repos/`, `services/`, `app/`, `supabase-js`, or any module that performs I/O. Violation = CI failure.

## Consequences

- The FP engine receives a `FactorTable` value as a parameter (injected by the service layer), not by reading the database. This decouples calculation from persistence.
- The OOP service layer is responsible for loading the factor table, calling `calc.calculate()`, and persisting `EmissionResult` rows — the seam is at the service-to-engine boundary.
- `InMemoryRepository<T>` (OOP, implements `abstract Repository<T>`) can replace `SupabaseRepository<T>` in unit tests with zero call-site changes — classic OOP polymorphism enabling FP-style test isolation.
- Property-based tests (fast-check) verify calc engine properties (associativity, idempotence) that would be untestable if the engine called the database.
