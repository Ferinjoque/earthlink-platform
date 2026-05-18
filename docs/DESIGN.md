# Sistema de Diseño · EarthLink ESG Auditor

> Dirección visual: **Editorial Climate-Tech**
> Inspiración: Persefoni (autoridad clínica, crema/forest) × Perplexity Hub (tipografía serif editorial, densidad intelectual)
>
> **Registro:** product — el diseño sirve a la función, no es el producto en sí.

---

## Principios

1. **Autoridad tranquila** — no grita. La credibilidad se transmite por jerarquía tipográfica y espacio, no por colores brillantes.
2. **Editorial, no corporativo** — los textos se leen como publicaciones de referencia, no como dashboards genéricos.
3. **Datos como protagonistas** — la UI encuadra los números; los colores de acento son para semántica (ok/warn/error), no decoración.
4. **Movimiento con propósito** — cada animación comunica estado o transición. Nada decorativo que no justifique el coste de atención.
5. **Densidad honesta** — tablas y formularios densos están bien si la jerarquía es clara.

## Anti-patrones prohibidos

- Grid de tarjetas uniformes sin jerarquía
- Hero centrado con blob de gradiente genérico
- Side-stripe border (`border-left: Xpx solid color`) como acento decorativo en cards/list items
- Gradient text (`background-clip: text` con gradiente) — nunca
- Glassmorphism decorativo sin propósito
- Texto placeholder que dice "coming soon" sin estructura visible
- Emojis en texto de UI (botones, mensajes, headings)
- Valores por defecto de Tailwind sin criterio (usar tokens CSS)

---

## Paleta — tokens actuales (`tokens.css`)

### Modo claro (default) — papel crema editorial

| Token | Valor | Uso |
|---|---|---|
| `--color-surface-0` | `#FAF7F0` | Fondo base — papel crema |
| `--color-surface-1` | `#FFFFFF` | Tarjeta elevada |
| `--color-surface-2` | `#F2EDE2` | Hundido / inputs |
| `--color-surface-3` | `#E9E2D2` | Panel acento |
| `--color-border` | `#E5DFD3` | Divisores |
| `--color-border-strong` | `#CFC6B0` | Divisores prominentes |
| `--color-ink-1` | `#0F1F1B` | Texto primario (forest oscuro) |
| `--color-ink-2` | `#4A5854` | Texto secundario |
| `--color-ink-3` | `#8B9591` | Placeholder / deshabilitado |
| `--color-ink-inverse` | `#FAF7F0` | Texto sobre fondos oscuros |
| `--color-accent` | `#1F5C45` | Verde musgo — acción primaria |
| `--color-accent-2` | `#2E7D5B` | Verde medio |
| `--color-accent-soft` | `#E3EBE5` | Fondo acento sutil |
| `--color-accent-dim` | `#4A8A6F` | Hover / inactivo |
| `--color-warm` | `#D97757` | Terracota — pop cálido |
| `--color-warm-soft` | `#F8E8DD` | Fondo terracota sutil |
| `--color-gold` | `#C9A14A` | Mostaza editorial — destacar |
| `--color-gold-soft` | `#F5EBD3` | Fondo mostaza sutil |
| `--color-scope2` | `oklch(56% 0.19 295)` | Violeta editorial — **solo Alcance 2** |
| `--color-scope2-soft` | `oklch(95% 0.04 295)` | Fondo Alcance 2 sutil |

### Modo oscuro `[data-theme="dark"]` — forest dusk

Usado por: sidebar, login hero. Fondos forest profundo `#0E1916` → `#233330`, acentos teal brillante `#4DD0A8`.

| Token | Valor oscuro |
|---|---|
| `--color-surface-0` | `#0E1916` |
| `--color-surface-1` | `#15211D` |
| `--color-surface-2` | `#1B2825` |
| `--color-surface-3` | `#233330` |
| `--color-accent` | `#4DD0A8` |
| `--color-ink-1` | `#F4F1EA` |
| `--color-ink-2` | `#B8B0A0` |

### Señales semánticas

| Severidad | Token fg | Token bg | Valor claro |
|---|---|---|---|
| Ok / bajo | `--color-signal-ok` | `--color-signal-ok-bg` | `#1F5C45` / `#E3EBE5` |
| Medio / precaución | `--color-signal-md` | `--color-signal-md-bg` | `#C9A14A` / `#F5EBD3` |
| Alto / error | `--color-signal-hi` | `--color-signal-hi-bg` | `#C0392B` / `#F8E5E1` |

---

## Tipografía

### Familias

| Variable | Fuente | Uso |
|---|---|---|
| `--font-sans` | Inter | UI, labels, cuerpo, datos |
| `--font-serif` | Instrument Serif | Headlines display, eyecatchers editoriales |
| `--font-mono` | JetBrains Mono | Datos numéricos, código, chips de fase |

Las variables de fuente se configuran con `next/font` en `layout.tsx` y se inyectan vía CSS variables `--font-inter`, `--font-instrument`, `--font-mono-stack`.

### Escala fluid (clamp)

| Token | Rango aprox. | Uso |
|---|---|---|
| `--text-xs` | 0.72–0.78rem | Eyebrow, meta, chips |
| `--text-sm` | 0.82–0.90rem | Labels, notas, form helpers |
| `--text-base` | 0.95–1.02rem | Cuerpo principal |
| `--text-lg` | 1.08–1.18rem | Subtítulos |
| `--text-xl` | 1.22–1.40rem | Títulos de sección |
| `--text-2xl` | 1.50–1.85rem | Títulos de página |
| `--text-3xl` | 1.95–2.60rem | KPI principal en dashboard |
| `--text-4xl` | 2.50–3.60rem | Display grande |
| `--text-display` | 3.20–5.50rem | Hero largo |
| `--text-hero` | 3.80–7.50rem | Hero máximo |

### Clases utilitarias (definidas en `typography.css`)

- `.font-display` — serif italic, tracking tightest, leading tight. Titulares hero.
- `.font-editorial` — serif normal, tracking tight. Subtítulos prominentes.
- `.eyebrow` — sans xs, fw-medium, uppercase, tracking widest, ink-3. Etiquetas de sección.
- `.numeric-tabular` — tnum, tabular-nums. Tablas de datos.

---

## Espaciado

Escala 4px base. Tokens disponibles: `--space-1` (0.25rem) → `--space-32` (8rem).
Valores existentes: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32. **No existen --space-7, --space-9, --space-11.**
Sección: `--space-section: clamp(4rem, 3rem + 5vw, 9rem)`.

Regla: ritmo no uniforme. Secciones distintas reciben espaciado distinto para crear jerarquía.

---

## Radios

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 3px | Micro chips |
| `--radius-sm` | 5px | Badges, tags |
| `--radius-md` | 8px | Inputs, botones, cards pequeñas |
| `--radius-lg` | 14px | Tarjetas principales |
| `--radius-xl` | 20px | Cards grandes |
| `--radius-2xl` | 28px | Modals, overlays |
| `--radius-pill` | 9999px | Pills, avatares |

---

## Sombras (cálidas, tinte forest)

- `--shadow-xs` — separación mínima (1px)
- `--shadow-sm` — inputs con foco, separación suave
- `--shadow-md` — tarjetas flotantes
- `--shadow-lg` — modals, cards login
- `--shadow-xl` — overlays máximos
- `--shadow-glow` — glow verde en elementos de acción principal

---

## Movimiento

### Easings

- `--ease-out-expo` — salidas, hover reveals `(0.16,1,0.3,1)`
- `--ease-spring` — entradas con overshoot `(0.34,1.56,0.64,1)`
- `--ease-in-out` — transiciones neutras

### Duraciones

| Token | ms | Uso |
|---|---|---|
| `--duration-micro` | 90 | Hover state, color change |
| `--duration-fast` | 180 | Focus, border |
| `--duration-normal` | 280 | Slide in/out |
| `--duration-editorial` | 520 | Page reveals, stagger |
| `--duration-slow` | 900 | Ambient, float |

### Keyframes globales (en `globals.css`)

- `fadeUp` — entrada desde abajo. Clase: `.animate-fade-up`
- `fadeIn` — opacidad
- `float` — flotación suave Y
- `shimmer` — skeleton loading
- `orbDrift` — deriva orbital (ambient)
- `ringSpin` — rotación anillo (spinner de carga en botones)
- `pulse-soft` — pulso de opacidad suave

### Stagger CSS

`.stagger-1` (80ms) → `.stagger-6` (780ms). Para secuencias de entrada.

### Regla de reducción de movimiento

Todos los keyframes se desactivan con `prefers-reduced-motion: reduce`. Siempre cumplir.

---

## Layout

- `--max-w-prose` 68ch — columna de texto
- `--max-w-content` 1240px — contenido app
- `--max-w-wide` 1480px — layouts amplios
- `--sidebar-w` 260px — sidebar fija
- `--topbar-h` 64px — header sticky

---

## Superficies implementadas

### Login hero (`src/app/(public)/login/page.tsx`)

División 60/40 (hero izq / form der). El hero usa `[data-theme="dark"]`.

**Hero:**
- Fondo sólido `oklch(10% 0.048 162)` (no imagen, no gradiente oscuro)
- Canvas `requestAnimationFrame`: 60-80 partículas esmeralda flotantes con conexiones dinámicas y pulso
- 2 gradientes radiales ambientales sutiles (`radial-gradient` con `mix-blend-mode: screen`)
- Textos animados Framer Motion (`motion/react`): eyebrow → headline serif italic → tagline → feature items

**Formulario:**
- Fondo `--color-surface-0` (crema)
- Email + password con estilos inline `var(--color-surface-2)` para inputs
- Spinner `ringSpin` en submit

### App shell

**Sidebar** (`src/components/shell/Sidebar.tsx`):
- `data-theme="dark"`, 260px fija
- Logo: hoja Lucide + "EarthLink" serif
- Nav items con active state
- Chip "FASE 6" al fondo

**TopBar** (`src/components/shell/TopBar.tsx`):
- Sticky 64px, blur backdrop
- `title` (Inter semibold) + `section` (JetBrains Mono xs, ink-3)
- Hint visual "Buscar… ⌘K"
- Avatar circular con inicial

### App pages (fondo crema, modo claro)

Todas las páginas bajo `(app)/` usan el fondo base `--color-surface-0`. Padding uniforme `var(--space-8)`. Secciones separadas por `gap: var(--space-8)`.

---

## Componentes

### Button (`src/components/ui/Button.tsx`)

```
primary  — background: accent, color: white
secondary — background: surface-2, border: border
ghost — background: transparent, color: ink-2
danger — background: signal-hi-bg, color: signal-hi
```

Tamaños: `sm` / `md` / `lg`. Estado `disabled`: opacity 0.5, cursor not-allowed.

### Card (`src/components/ui/Card.tsx`)

- Base: `surface-1`, `border`, `radius-lg`, `shadow-sm`
- StatCard: valor mono + label eyebrow + delta opcional (usado en Dashboard KPIs)
- ⚠️ La variante `accent` usa `border-left: 3px solid` — anti-patrón según design laws. Pendiente de reemplazar con background tint.

### Badge (`src/components/ui/Badge.tsx`)

Variantes por estado de periodo:

| Variante | Color | Label |
|---|---|---|
| `open` | verde (accent-soft) | Abierto |
| `calculating` | mostaza | Calculando |
| `under_review` | naranja/warm | En revisión |
| `locked` | ink-2 (neutro) | Bloqueado |
| `draft` | ink-3 | Borrador |
| `submitted` | gold | Enviado |
| `validated` | signal-ok | Validado |
| `rejected` | signal-hi | Rechazado |

### AnomalyBadge (`src/components/activity/AnomalyBadge.tsx`)

Chip de severidad: `low` / `medium` / `high`. Usa colores semánticos (signal-ok / signal-md / signal-hi). Muestra z-score y mensaje.

### ActivityForm (`src/components/activity/ActivityForm.tsx`)

Client Component. Campos: periodo, fuente de emisión, secundario (combustible/refrigerante/región), cantidad, unidad, notas. Validación Zod. Errores por campo + borde rojo en campos inválidos. Banner éxito/error con íconos. Spinner en submit.

### CsvImportPanel (`src/components/activity/CsvImportPanel.tsx`)

Client Component. Drag-and-drop zone + textarea paste. Botón "Descargar plantilla". Vista previa de filas parseadas con estado por fila. Parser flexible: detecta delimitador automáticamente (`,` `;` `\t`), acepta headers en español o inglés, fallback posicional.

### PeriodActions (`src/components/audit/PeriodActions.tsx`)

Client Component. Dos forms con `useActionState` independientes. Status `open` → "Calcular CO₂e". Status `under_review` → "Bloquear periodo". Sin emojis.

---

## Identidad de marca

- **Nombre:** EarthLink (nombre propio, no traducir)
- **Tagline:** Trazabilidad climática para tu cadena de suministro
- **Icono:** hoja Lucide sobre fondo accent, `radius-md`
- **Paleta primaria:** verde musgo `#1F5C45` (claro) / teal `#4DD0A8` (oscuro)
- **Paleta secundaria:** terracota `#D97757`, mostaza `#C9A14A`
- **Tipografía display:** Instrument Serif italic
- **Tipografía UI:** Inter

---

## Do / Don't

| Do | Don't |
|---|---|
| Usar `.eyebrow` antes de secciones | Empezar sección directamente con h2 sin contexto |
| Datos en `--font-mono` con `numeric-tabular` | Datos en sans sin tabular-nums |
| Colores señal solo para semántica | Usar accent verde para decoración genérica |
| Animar solo `transform` y `opacity` | Animar `width`, `height`, `top`, `margin` |
| Respetar `prefers-reduced-motion` | Asumir que todos quieren animaciones |
| Labels en español hardcoded | Añadir librerías i18n |
| Jerarquía por tamaño+peso+espacio | Jerarquía solo por color |
| Background tint para highlight de card | `border-left` como acento decorativo |
| Estilos inline con tokens CSS | Clases Tailwind para layout/color |
| Borde completo en campo inválido | Solo texto de error debajo sin indicación visual |
