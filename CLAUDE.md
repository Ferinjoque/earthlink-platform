# EarthLink — Contexto para Claude

> Leer este archivo **antes de cualquier sesión**. Refleja el estado real del código, no un plan futuro.
> Fuente de verdad complementaria de diseño: `docs/DESIGN.md`.

---

## Identidad del proyecto

**EarthLink** es un auditor GHG (Greenhouse Gas) SaaS multi-tenant para contabilidad de Alcance 1 y 2 según el GHG Protocol. Consultores crean organizaciones, gestionan proveedores y periodos de reporte; proveedores suben datos de consumo; el motor de cálculo convierte esos datos a tCO₂e con factores de emisión versionados; los auditores revisan y bloquean periodos para registro inmutable.

**Stack:**

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, `src/app/`) |
| React | React 19, Server Components por defecto |
| Lenguaje | TypeScript 5 strict + `noUncheckedIndexedAccess` |
| Base de datos | Supabase (Postgres + Auth + RLS) |
| Cliente DB | `@supabase/ssr` con cookies server-side |
| Estilos | CSS custom properties (`tokens.css`). Sin Tailwind para layout/color. |
| Fuentes | Inter (UI), Instrument Serif (display), JetBrains Mono (datos numéricos) |
| Animaciones | Framer Motion (`motion/react`) + canvas `requestAnimationFrame` |
| Validación | Zod (en Server Actions) |
| Aritmética | big.js (motor de cálculo, 6 dp) |
| Unit tests | Vitest |
| E2E | Playwright |
| CI | GitHub Actions |
| Deploy | Vercel + Supabase free tier |

**Dev server:** `pnpm dev` → `http://localhost:3002`

**Demo user:** `admin@earthlink.test` / `Earthlink2025!` — rol admin en ambas orgs.

---

## Convenciones de código (CRÍTICO — no negociables)

1. **Todo en español** — labels, placeholders, mensajes de error, copy de UI. Sin i18n. Sin inglés en la interfaz.
2. **Sin emojis en texto de UI** — nunca en botones, mensajes, headings ni copy.
3. **Estilos inline con tokens CSS** — `style={{ color: 'var(--color-accent)' }}`. Sin clases Tailwind para layout/color.
4. **Server Components por defecto** — `'use client'` solo cuando hay estado React, efectos o event handlers del DOM.
5. **Hover en Server Components** — vía `<style>{'.clase:hover { ... }'}</style>` + `className`, nunca `onMouseEnter` inline.
6. **Server Actions para mutaciones** — `'use server'`, Zod validation, `useActionState` en cliente.
7. **Sin side-stripe borders** — `border-left: Xpx solid color` como acento decorativo está prohibido. Usar background tint (`--color-accent-soft`) o borde completo.
8. **Sin gradient text** — `background-clip: text` con gradiente está prohibido. Texto en color sólido.
9. **Sin `any` en TypeScript** — usar `unknown` y narrowing. Sin `console.log` en código.
10. **Sin `.select('*')`** — seleccionar solo columnas necesarias en Server Components.
11. **Dirección de diseño** — "editorial climate-tech / quiet authority". No SaaS genérico. Ver `docs/DESIGN.md`.

---

## Arquitectura de código

```
src/
├── app/
│   ├── (public)/
│   │   ├── login/page.tsx      Login (split: hero oscuro + form)
│   │   └── layout.tsx          Layout público sin sidebar
│   └── (app)/
│       ├── dashboard/page.tsx  Panel principal (KPIs + distribución)
│       ├── activity/page.tsx   Registros de actividad
│       ├── suppliers/page.tsx  Proveedores
│       ├── audit/page.tsx      Consola de auditoría
│       ├── reports/page.tsx    Reportes (placeholder)
│       └── layout.tsx          App shell (Sidebar + TopBar)
├── actions/
│   ├── auth.ts                 signIn, signOut
│   ├── activity.ts             submitActivity, importCsv
│   └── audit.ts                calculatePeriod, lockPeriod
├── calc/                       Motor FP puro — sin I/O ni side effects
├── domain/                     Entidades OOP (EmissionSource hierarchy, etc.)
├── repos/                      Repositorios Supabase + InMemory (tests)
├── services/                   EvaluationService, AuditService, AnomalyService
├── components/
│   ├── shell/                  Sidebar.tsx, TopBar.tsx
│   ├── activity/               ActivityForm, ActivityList, CsvImportPanel, AnomalyBadge
│   ├── audit/                  PeriodActions.tsx
│   └── ui/                     Button, Card, Badge, AnomalyBadge
├── lib/                        csv.ts (parse + template), auth utils
├── services/supabase/          createServerClient(), createAdminClient()
├── styles/                     tokens.css, typography.css
└── types/                      database.ts (generado Supabase CLI)
```

---

## Base de datos

**15 tablas, 4 grupos:**

| Grupo | Tablas |
|---|---|
| Referencia (5) | `fuel_types`, `refrigerants`, `grid_regions`, `emission_factors`, `unit_conversions` |
| Acceso (3) | `organizations`, `suppliers`, `memberships` |
| Transaccional (5) | `reporting_periods`, `activity_entries`, `emission_results`*, `evidence_files`, `anomaly_flags` |
| Auditoría (2) | `audit_log`*, `report_exports`* |

\* Append-only — triggers bloquean UPDATE y DELETE.

**Migraciones:** 001 → 020 aplicadas (incluyendo `archived_at` en suppliers, `data_quality` en activity_entries, políticas RLS actualizadas).

**Seed:**
- 2 orgs: EcoGroup SAC (PE), Andean Mining Corp (PE)
- 6 proveedores en ambas orgs
- 12 periodos: 6 locked (Q4-2025), 2 under_review (Q1-2026), 4 open (Q1-2026)
- `emission_results` pre-cargados para periodos locked
- 1 anomaly flag activa: Lima Printing Q1-2026, z-score 45.88

**RLS roles:** `admin` | `consultant` | `supplier`. Demo user = admin en ambas orgs.

**IMPORTANTE:** Las memberships de admin/consultant tienen `supplier_id = null`. Para queries de periodos/entradas por usuario, hay que hacer join vía org → suppliers, no asumir supplier_id directo.

---

## Estado actual de la UI

> **Última actualización:** 2026-05-19. Plataforma completa y funcional. Todos los flujos principales implementados.

### `/login` — Completo ✅

Split 100dvh: hero oscuro izquierda (58%) + formulario derecha (42%).
Canvas rAF con 80-90 partículas esmeralda. Framer Motion entrance en hero y form. Lazy-load de `ParticleField`.

---

### App shell — Completo ✅

**Sidebar** (260px, `data-theme="dark"`):
- Navegación: Panel / Proveedores / Actividad / Auditoría / Reportes / Configuración.
- Badge rojo con conteo de anomalías no resueltas en ítem "Auditoría".
- Cerrar sesión al fondo.

**TopBar** (64px, sticky, backdrop blur):
- `title`, `email`, `section` (breadcrumb).
- Búsqueda ⌘K global (`SearchProvider` + `SearchModal` client component).
- Avatar con inicial del email.

**Layout app** (`src/app/(app)/layout.tsx`):
- `PageTransition` — fade-in `y: 5→0` en cada cambio de ruta.
- `ToastProvider` — sistema toast global con `createPortal`.
- `SearchProvider` — suppliers para búsqueda global.
- Fetch anomalía count para badge de sidebar.

---

### `/dashboard` — Completo ✅

- 4 KPIs: CO₂e verificado / Cobertura / Anomalías activas / En revisión. Semáforos semánticos.
- `YearSelector` — filtro por año vía searchParam `?year=X`.
- Ranking por emisiones (leaderboard): barras scope1/scope2 con `.bar-animate`.
- Mezcla de fuentes: barras horizontales con `.bar-animate`.
- Pipeline de auditoría: tabla matriz proveedor × periodo con pills de estado.
- Tendencia anual CO₂e: SVG artesanal con 12 barras mensuales.
- Anomalías pendientes: panel de alerta con top-3 + CTA a /audit.
- `AmbientBackground` — gradientes sutiles de fondo.
- Stagger 1→6 en todas las secciones. Estado vacío descriptivo.

---

### `/activity` — Completo ✅

- **BulkImportPanel** (`'use client'`): tabs Manual / CSV / Excel. Selección de proveedor + periodo. Form manual con Zod. CSV drag-and-drop con preview. Excel con xlsx.
- Campo `data_quality` incluido en formulario, CSV y Excel templates.
- **ActivityList**: tabla paginada (25/página), AnomalyBadge, estado de entrada, void info. Columna Fuente sin tooltip.
- Estado vacío cuando no hay proveedores.
- Paginación real con `?page=N`.
- Stagger 1→2 en secciones.

---

### `/suppliers` — Completo ✅

- **SupplierTable** (`'use client'`): tabla con nombre/categoría/email/RUC/periodos, búsqueda client-side, filtro por categoría.
- CRUD inline: crear proveedor (form expandible), editar, archivar (soft-delete con `archived_at`).
- **`/suppliers/[id]`**: KPIs CO₂e, períodos de reporte con estados + acciones, últimas entradas de actividad.
- **NuevoPeriodoForm**: crear periodo desde detalle del proveedor.
- Stagger 1→3 en secciones.

---

### `/audit` — Completo ✅

- **AuditTable** (`'use client'`): tabla de periodos con filtros por estado, expand inline de resultados y anomalías. `PeriodActions` para calcular/bloquear.
- Chips de conteo por estado + filtro de año (links a `?year=Y`).
- **LockedPeriodsTable**: resumen compacto de periodos bloqueados.
- **`/audit/[periodId]`**: página de detalle completa — KPIs CO₂e, anomalías activas con severidad, tabla de resultados por entrada, audit log timeline.
- Stagger 1→5 en secciones de detalle.

---

### `/reports` — Completo ✅

- **ReportsPanel** (`'use client'`): lista de periodos exportables (status `under_review` o `locked`) agrupados por año.
- Exportar CSV: emission_results + factor provenance + sha256 (`crypto.createHash`).
- Guardar en `report_exports` con org_id y period IDs.
- Historial de exports con sha256 y fecha.
- Modo impresión CSS (`@media print`): oculta chrome, cover page generada.
- Stagger 1→2 en secciones.

---

### `/settings` — Completo ✅

- 3 secciones: Cuenta (email, fecha), Organización (nombre, país, industria), Permisos (rol activo).
- Enlace en sidebar (ícono Settings).
- Stagger 1→4.

---

### `/consumo` — Completo ✅

- **ConsumoPanel** (`'use client'`): medidores virtuales por fuente. Conversiones de unidades desde DB (kWh, m³, kg).
- Entradas de actividad filtradas por tipo (electricidad, gas, agua).
- Stagger wrapper.

---

### Animaciones — Completo ✅

- **PageTransition**: `fade-in y:5→0` en cada cambio de ruta (Framer Motion, `PageTransition.tsx`).
- **Stagger CSS** (`animate-fade-up stagger-1..6`): todas las páginas tienen stagger de entrada en sus secciones.
- **`.bar-animate`** (`barGrow` keyframe): barras del leaderboard y mezcla de fuentes en Dashboard animan desde 0.
- `prefers-reduced-motion: reduce` desactiva todas las animaciones.

---

### Tests — Completo ✅

- **Unit**: 514 tests, 24 archivos, Vitest. Cobertura ≥ 75%.
- **E2E**: `auth.setup.ts` (storageState) + 6 spec files para todas las páginas autenticadas.
- `playwright.config.ts`: proyecto `setup` como dependencia de los proyectos de browser.

---

## Tokens de diseño clave (`src/styles/tokens.css`)

Tokens más usados en componentes:

| Token | Uso |
|---|---|
| `--color-accent` / `--color-accent-soft` | Verde musgo — acción primaria / fondo sutil |
| `--color-scope2` / `--color-scope2-soft` | Violeta editorial — Alcance 2 exclusivamente |
| `--color-signal-ok/md/hi` + `-bg` | Semáforo anomalías: verde/mostaza/rojo |
| `--color-surface-0/1/2/3` | Crema base / tarjeta / input / acento |
| `--color-ink-1/2/3` | Texto primario / secundario / deshabilitado |
| `--font-sans/serif/mono` | Inter / Instrument Serif / JetBrains Mono |
| `--text-xs` → `--text-hero` | Escala clamp responsiva |
| `--space-1` → `--space-32` | Espaciado 4px base |
| `--radius-md/lg/xl` | Bordes redondeados estándar |

Modo oscuro `[data-theme="dark"]`: usado por Sidebar y login hero. Ver `docs/DESIGN.md` para valores completos.

---

## Componentes UI existentes

**`Button`** — variantes: `primary` | `secondary` | `ghost` | `danger`. Tamaños: `sm` | `md` | `lg`.

**`Badge`** — variantes de estado de periodo: `open` | `calculating` | `under_review` | `locked` | `neutral`. Todos los labels en español.

**`AnomalyBadge`** — chip con severidad `low/medium/high`. z-score + mensaje en tooltip.

**`Card`** — base surface-1 + borde. Variante `accent`: background tint `--color-accent-soft` + borde sutil (sin `border-left` anti-patrón).

---

## Patrones de código

### Server Action

```typescript
'use server';
import { z } from 'zod';
import { createServerClient } from '@/services/supabase/server';
import { revalidatePath } from 'next/cache';

const schema = z.object({ /* ... */ });

export interface MyActionState {
  error?: string;
  success?: boolean;
}

export async function myAction(
  _prev: MyActionState | null,
  formData: FormData,
): Promise<MyActionState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Error de validación' };

  revalidatePath('/ruta');
  return { success: true };
}
```

### Client Component con form

```typescript
'use client';
import { useActionState } from 'react';
import { myAction, type MyActionState } from '@/actions/my-action';

export function MyForm() {
  const [state, formAction, isPending] = useActionState<MyActionState | null, FormData>(
    myAction, null,
  );

  return (
    <form action={formAction}>
      {state?.error && <div role="alert" style={{ color: 'var(--color-signal-hi)' }}>{state.error}</div>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
```

### Hover en Server Component (tabla)

```tsx
<>
  <style>{`.mi-fila:hover { background: var(--color-surface-2) !important; }`}</style>
  <table>
    {rows.map(row => <tr key={row.id} className="mi-fila">...</tr>)}
  </table>
</>
```

### Nueva migración SQL

Nombre: `supabase/migrations/20260519NNNNNN_descripcion.sql`  
Incluir siempre `DROP POLICY IF EXISTS` / `DROP TABLE IF EXISTS` antes de crear.  
Aplicar: `npx supabase db push`

---

## Lista de tareas — prioridades

> **Estado 2026-05-19:** Plataforma funcional completa. Todas las P1/P2/P3 anteriores están implementadas.
> Lo que sigue es polish avanzado y mejoras opcionales.

### Pendiente — polish y mejoras

| # | Tarea | Archivos clave |
|---|---|---|
| A | Filtros de tabla en `/activity`: por estado/fuente/periodo (client-side) | `ActivityList.tsx` |
| B | "Marcar anomalía como revisada" en `/audit/[periodId]` | `src/actions/audit.ts`, AuditTable |
| C | Skeletons de carga (`shimmer`) en Dashboard y tablas largas | Dashboard, tablas |
| D | Exportación PDF con `window.print()` ya implementada — mejorar CSS de impresión | `ReportsPanel.tsx` |
| E | Test de cobertura: `npx vitest run --coverage` y subir a 80%+ en branches | `vitest.config.ts` |

---

## Lo que NO hacer

- `className` de Tailwind para colores/spacing → usar tokens CSS
- Modales como primera solución → preferir forms inline, paneles expandibles, páginas nuevas
- `border-left: Xpx solid color` como acento decorativo → background tint
- `background-clip: text` con gradiente → color sólido
- Emojis en UI
- `console.log` en código
- `any` en TypeScript → `unknown` + narrowing
- `.select('*')` en Server Components → seleccionar columnas específicas
- Texto de interfaz en inglés → todo en español
- `useEffect` para fetching → usar Server Components o Server Actions
