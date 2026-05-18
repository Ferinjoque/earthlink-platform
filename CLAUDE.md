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

**Migraciones:** 001 → 010 aplicadas. La 010 añade INSERT policy en `emission_results` para admin/consultant.

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

### `/login` — Completo ✅

Split 100dvh: hero oscuro izquierda (58%) + formulario derecha (42%).

**Hero (`oklch(10% 0.048 162)`):**
- Canvas rAF: ~80-90 partículas esmeralda con conexiones dinámicas y pulso. Cada 7mo nodo es "bright" (glow más intenso).
- Radiales ambientales: verde top-right, ámbar bottom-left.
- Framer Motion: eyebrow → h1 serif italic → descripción → PILARES (3 bullets) → badges de certificación.
- Wordmark top-left animado.
- Responsive: hero oculto en mobile, form ocupa 100dvh.

**Formulario:** email + password + spinner + error inline + Framer Motion entrance.

---

### App shell — Completo ✅

**Sidebar** (260px, `data-theme="dark"`, `position: sticky`):
- Wordmark: icono Leaf + "EarthLink" serif + "Auditor ESG" mono.
- Navegación: Panel / Proveedores / Actividad / Auditoría / Reportes.
- Estado activo: `oklch(58% 0.16 155 / 16%)` fondo, acento verde.
- Cerrar sesión: botón al fondo (form → signOut action).

**TopBar** (64px, sticky, backdrop blur):
- Props: `title`, `email`, `section` (breadcrumb).
- Hint "Buscar… ⌘K", avatar con inicial del email.

---

### `/dashboard` — Parcial ⚠️

**Implementado:**
- Titular editorial (serif italic) con eyebrow "Protocolo GHG · Alcances 1 y 2".
- KPI strip: Total CO₂e (protagonista, mono tabular) + Alcance 1 (verde) + Alcance 2 (violeta `--color-scope2`). Dividido por `border-left` semántico (datos, no decoración).
- Barras de distribución horizontal: Alcance 1 vs Alcance 2, % + valor. CSS transition `700ms`.
- Indicador de periodos abiertos (dot verde + contador).
- Lista editorial de módulos (4 items): icono + título + descripción + fase.
- Estado vacío: mensaje descriptivo cuando `totalCo2eKg === 0`.

**Falta:**
- Gráfico tendencia mensual CO₂e (últimos 6 meses, SVG artesanal o recharts).
- Feed actividad reciente (últimas 5-8 entradas con badge anomalía).
- Tarjeta de anomalías pendientes (count + CTA a /audit).

---

### `/activity` — Mayormente completo ✅⚠️

**Implementado:**
- **ActivityForm** (`'use client'`): todos los campos con validación Zod, bordes rojos en campos inválidos (`estiloInput(hasError)`, `estiloSelect(hasError)`), spinner en submit, banner éxito/error.
- **CsvImportPanel** (`'use client'`): drag-and-drop, pegar CSV, detección automática de delimitador (`,` `;` `\t`), aliases de columna español/inglés, vista previa por fila, botón "Descargar plantilla" (`getCsvTemplate()`).
- **ActivityList**: tabla con AnomalyBadge, estado de entrada, timestamp.
- Query correcta para admin: memberships con `supplier_id = null` se resuelven via org → suppliers.

**Falta:**
- Estado vacío elegante cuando no hay periodos abiertos o entradas.
- Filtros de tabla (por estado, fuente, periodo).
- Detalle de entrada al hacer clic (factores usados, hash sha256, trazabilidad).
- Paginación (actualmente límite hardcoded 100).

---

### `/suppliers` — Parcial ⚠️

**Implementado:**
- Tabla: nombre, categoría, email, cantidad de periodos.
- CSS hover con `<style>` tag (Server Component).

**Falta (CRUD completo):**
- Crear proveedor: form expandible inline (no modal). Campos: nombre, categoría, contacto, RUC.
- Editar proveedor: mismo form, pre-populated.
- Archivar: soft-delete con columna `archived_at` en `suppliers` (migración requerida).
- Vista detalle `/suppliers/[id]`: periodos del proveedor, últimas entradas, CO₂e histórico.
- Crear periodo desde vista detalle.
- Estado vacío.
- Búsqueda client-side por nombre/categoría.

---

### `/audit` — Parcial ⚠️

**Implementado:**
- Chips de estado con conteo por estado.
- Tabla de periodos: proveedor, label, fechas, estado (Badge), CO₂e total, acciones.
- **PeriodActions**: `open` → "Calcular CO₂e" (EvaluationService → INSERT emission_results); `under_review` → "Bloquear periodo" (AuditService → status locked).
- Tarjetas de periodos bloqueados: background `--color-accent-soft`, borde verde sutil (sin side-stripe).
- CSS hover en filas.

**Falta:**
- Vista inline de resultados post-cálculo: tabla CO₂e por entrada (source_type, raw_quantity, co2e_kg, scope, factor usado).
- Panel de anomalías activas del periodo (con acción "Marcar como revisado").
- Filtro por estado en tabla de periodos.
- Botón "Nuevo periodo" (form inline: proveedor, label, fecha inicio/fin).
- Log de auditoría visible: quién calculó, cuándo, versión del motor.

---

### `/reports` — Vacío ❌

Solo placeholder. Falta todo:
- Lista de periodos exportables (status `under_review` o `locked`).
- Exportar CSV: emission_results + factor provenance. Action con `crypto.createHash('sha256')`.
- Guardar registro en `report_exports`.
- Exportar PDF (opcional: `@react-pdf/renderer` o `window.print()` con CSS impresión).
- Historial de exportaciones con sha256.

---

### `/settings` — No existe ❌

Falta crear `src/app/(app)/settings/page.tsx`:
- Email del usuario, nombre de la organización, rol.
- Enlace en sidebar (Settings icon o avatar del TopBar clickeable).

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

**`Card`** — base surface-1 + borde. **Nota:** la variante Accent aún usa `border-left` — pendiente de limpiar a background tint.

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

### P1 — Funcionalidad esencial

| # | Tarea | Archivos clave |
|---|---|---|
| 1.1 | Página `/settings` (email, org, rol) + enlace en sidebar | `src/app/(app)/settings/page.tsx`, `Sidebar.tsx` |
| 1.2 | CRUD proveedores: crear/editar/archivar inline + migración `archived_at` | `src/app/(app)/suppliers/`, `src/actions/suppliers.ts` (nuevo), migración |
| 1.3 | Vista detalle proveedor `/suppliers/[id]`: periodos, CO₂e, crear periodo | `src/app/(app)/suppliers/[id]/page.tsx` (nuevo) |
| 1.4 | Resultados de auditoría post-cálculo: tabla inline CO₂e por entrada | `src/app/(app)/audit/page.tsx`, `src/components/audit/` |
| 1.5 | Panel de reportes: exportar CSV + sha256 + guardar en `report_exports` | `src/app/(app)/reports/page.tsx`, `src/actions/reports.ts` (nuevo) |

### P2 — Completar paneles

| # | Tarea | Archivos clave |
|---|---|---|
| 2.1 | Dashboard: gráfico tendencia mensual CO₂e (SVG artesanal, últimos 6 meses) | `src/app/(app)/dashboard/page.tsx` |
| 2.2 | Dashboard: feed actividad reciente (5-8 entradas) + tarjeta anomalías pendientes | `src/app/(app)/dashboard/page.tsx` |
| 2.3 | Actividad: estado vacío + filtros (estado/fuente/periodo) | `src/app/(app)/activity/page.tsx`, `ActivityList.tsx` |
| 2.4 | Auditoría: panel anomalías (listar + "Marcar revisado") + filtro por estado + "Nuevo periodo" | `src/app/(app)/audit/page.tsx`, acciones audit |

### P3 — QoL y polish

| # | Tarea | Archivos clave |
|---|---|---|
| 3.1 | Estados vacíos consistentes en todas las páginas | Todas las páginas |
| 3.2 | Sistema toast global (`createPortal` + CSS) | `src/components/ui/Toast.tsx` (nuevo), app layout |
| 3.3 | Skeletons de carga (`shimmer` keyframe ya existe) | Dashboard, tablas |
| 3.4 | Card Accent: limpiar `border-left` anti-pattern → background tint | `src/components/ui/Card.tsx` |
| 3.5 | Badge anomalías en sidebar (count no resueltos en ítem "Auditoría") | `Sidebar.tsx`, query en layout |

### P4 — Avanzado

| # | Tarea |
|---|---|
| 4.1 | Exportación PDF (`@react-pdf/renderer` o `window.print()`) |
| 4.2 | Página detalle periodo `/audit/[periodId]`: emission results completos + audit log |
| 4.3 | Búsqueda ⌘K global (command palette) |

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
