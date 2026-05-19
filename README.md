# EarthLink Platform

[![CI](https://github.com/Ferinjoque/earthlink-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Ferinjoque/earthlink-platform/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5%20strict-3178C6)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)

---

> **Proyecto academico — aviso importante**
>
> EarthLink Platform es un proyecto de portfolio desarrollado exclusivamente con fines de
> aprendizaje y demostracion tecnica. No representa un producto comercial real ni un sistema
> en produccion.
>
> **Sin afiliacion con marcas existentes.** El nombre "EarthLink" se usa unicamente como
> nombre ficticio para este proyecto. No existe ninguna relacion, asociacion ni vinculo con
> ninguna empresa, producto o marca registrada que pueda llevar ese nombre, incluyendo
> cualquier proveedor de telecomunicaciones u otro servicio.
>
> **Sin vinculacion con ninguna plataforma, empresa o servicio de sostenibilidad.** Este proyecto
> no representa, no esta afiliado ni se desprende de los productos, servicios, metodologias
> ni de ninguna organizacion
> relacionada. Las funcionalidades, el diseno del dominio y los datos de ejemplo son
> enteramente ficticios.
>
> El uso de este proyecto con fines comerciales requiere permiso expreso del autor.
> Ver [LICENSE](LICENSE).

---

Plataforma SaaS multi-tenant para contabilidad de gases de efecto invernadero (GEI) de
Alcance 1 y 2 segun el GHG Protocol. Reemplaza el seguimiento manual en hojas de calculo
con un ledger auditado e inmutable: cada tCO2e reportada es trazable hasta el dato bruto,
el factor de emision versionado, la version del motor de calculo y el usuario que lo envio.

---

## Que hace

- Los proveedores registran datos de consumo (combustibles, electricidad) a traves de un
  formulario guiado o importacion CSV/Excel.
- Un motor de calculo funcional puro convierte los datos brutos a tCO2e usando factores de
  emision versionados y aritmetica de punto fijo.
- Los consultores y administradores revisan resultados, gestionan anomalias estadisticas y
  bloquean periodos para registro inmutable.
- Los periodos bloqueados generan reportes exportables con hash SHA-256 para trazabilidad.

---

## Arquitectura

El sistema separa deliberadamente dos paradigmas de programacion:

```
src/app/          Next.js App Router (capa delgada)
  |
services/         POO  - servicios de orquestacion
  +---> repos/    POO  - Repository<T> abstracto + implementaciones Supabase
  |      +---> Supabase (Postgres + RLS + Storage)
  +---> calc/     FP puro - sin efectos secundarios, sin I/O
domain/           POO  - jerarquia EmissionSource, value objects
```

### Capa POO (`domain/`, `repos/`, `services/`)

- `abstract EmissionSource` con implementaciones concretas: `StationaryCombustionSource`,
  `MobileCombustionSource`, `PurchasedElectricitySource`, `PurchasedSteamSource`,
  `FugitiveEmissionSource`.
- `abstract Repository<TEntity>` con `SupabaseRepository<T>` e `InMemoryRepository<T>`
  (para tests).
- Polimorfismo: `source.validate(raw)` y `source.factorKey()` sin type switching.

### Motor FP (`calc/`)

- Union discriminada `ActivityKind` cubre todos los tipos de actividad de Alcance 1 y 2.
- Pipeline puro: `validateActivity -> normalizeUnit -> resolveFactor -> applyFactor -> stampProvenance`.
- Determinismo: aritmetica de punto fijo con `big.js`, redondeo unico al final, hash de
  calculo `sha256(canonical(inputs))`.

---

## Base de datos

15 tablas organizadas en 4 grupos:

| Grupo | Tablas |
|---|---|
| Referencia (5) | fuel_types, refrigerants, grid_regions, emission_factors, unit_conversions |
| Acceso (3) | organizations, suppliers, memberships |
| Transaccional (5) | reporting_periods, activity_entries, emission_results\*, evidence_files, anomaly_flags |
| Auditoria (2) | audit_log\*, report_exports\* |

\* Append-only: triggers de base de datos bloquean UPDATE y DELETE para garantizar la
inmutabilidad del registro auditado.

---

## Stack tecnico

| Componente | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Lenguaje | TypeScript 5 (strict + noUncheckedIndexedAccess) |
| Base de datos | Supabase (Postgres + Auth + RLS) |
| Estilos | CSS custom properties con tokens OKLCH |
| Animaciones | Framer Motion + canvas requestAnimationFrame |
| Validacion | Zod (en Server Actions) |
| Aritmetica | big.js (punto fijo, 6 decimales) |
| Tests unitarios | Vitest |
| Tests E2E | Playwright (chromium + firefox + webkit) |
| CI | GitHub Actions |
| Deploy | Vercel + Supabase |

---

## Configuracion rapida

```bash
# Requisitos: Node 20+, pnpm 9+

pnpm install
cp .env.example .env.local
# Completar NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Aplicar migraciones
npx supabase db push

# Cargar datos de demostracion
npx tsx scripts/seed-demo.ts

# Servidor de desarrollo
pnpm dev   # http://localhost:3002
```

### Credenciales de demo

```
email:      admin@earthlink.test
contrasena: Earthlink2025!
```

Rol admin en ambas organizaciones de ejemplo (EcoGroup SAC y Andean Mining Corp).

### Scripts disponibles

```bash
pnpm dev            # Servidor de desarrollo
pnpm build          # Build de produccion
pnpm test           # Tests unitarios
pnpm test:coverage  # Tests con cobertura
pnpm test:e2e       # Tests E2E con Playwright
pnpm typecheck      # Verificacion de tipos
pnpm lint           # ESLint
```

---

## Estructura del proyecto

```
src/
  calc/           Motor de calculo GEI - FP puro, sin I/O
  domain/         Entidades de dominio OOP
  repos/          Repositorios Supabase e InMemory
  services/       EvaluationService, AuditService, AnomalyService
  actions/        Server Actions con validacion Zod
  components/
    shell/        Sidebar, TopBar
    activity/     Formulario, lista, importador CSV, badge de anomalia
    audit/        Acciones de periodo, tabla de periodos bloqueados
    ui/           Button, Card, Badge, YearSelector
  lib/            Utilidades (CSV, formato, periodos)
  styles/         tokens.css, typography.css, globals.css
  types/          database.ts (generado por CLI de Supabase)
supabase/
  migrations/     SQL progresivo (20 migraciones)
scripts/
  seed-demo.ts    Carga de datos de demostracion
```

---

## Alcance GHG Protocol

- **Alcance 1**: Combustion estacionaria (gas natural, diesel, GLP), combustion movil
  (flota), emisiones fugitivas (refrigerantes).
- **Alcance 2**: Electricidad comprada (base de ubicacion), vapor comprado.
- **Alcance 3**: Explicitamente fuera del alcance de este proyecto.

---

## Despliegue en Vercel

1. Conecta el repositorio en el dashboard de Vercel.
2. Configura las variables de entorno (las mismas que en `.env.local`).
3. Vercel detecta Next.js automaticamente. Las cabeceras de seguridad estan definidas en
   `vercel.json`.

---

## Licencia

[CC BY-NC 4.0](LICENSE) — libre para uso personal y educativo con atribucion al autor.
Uso comercial requiere permiso expreso.
