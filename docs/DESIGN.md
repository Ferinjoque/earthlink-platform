# Sistema de Diseño · EarthLink ESG Auditor

> Dirección visual: **Editorial Climate-Tech**
> Inspiración: Persefoni (autoridad clínica, crema/forest) × Perplexity Hub (tipografía serif editorial, densidad intelectual)

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
- Valores por defecto de Tailwind sin criterio
- Layouts planos sin profundidad ni estratificación
- Color único de acento como único punto de vista
- Texto placeholder que dice "coming soon" sin estructura visible

---

## Paleta

### Modo claro (default)

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
| `--color-accent` | `#1F5C45` | Verde musgo — acción primaria |
| `--color-accent-2` | `#2E7D5B` | Verde medio |
| `--color-accent-soft` | `#E3EBE5` | Fondo acento sutil |
| `--color-warm` | `#D97757` | Terracota — pop cálido |
| `--color-gold` | `#C9A14A` | Mostaza editorial — destacar |

### Modo oscuro (sidebar / overlays)

El sidebar usa `data-theme="dark"`. Fondos forest profundo (`#0E1916` → `#233330`), acentos teal brillante (`#4DD0A8`).

### Señales semánticas

| Severidad | Color | Fondo |
|---|---|---|
| Ok / bajo | `--color-signal-ok` `#1F5C45` | `--color-signal-ok-bg` `#E3EBE5` |
| Medio / precaución | `--color-signal-md` `#C9A14A` | `--color-signal-md-bg` `#F5EBD3` |
| Alto / error | `--color-signal-hi` `#C0392B` | `--color-signal-hi-bg` `#F8E5E1` |

---

## Tipografía

### Familias

| Variable | Fuente | Uso |
|---|---|---|
| `--font-sans` | Inter | UI, labels, cuerpo, datos |
| `--font-serif` | Instrument Serif | Headlines display, eyecatchers editoriales |
| `--font-mono` | JetBrains Mono | Datos numéricos, código, chips de fase, monospaced |

### Escala (clamp fluid)

| Token | Rango | Uso |
|---|---|---|
| `--text-xs` | 0.72–0.78rem | Eyebrow, meta |
| `--text-sm` | 0.82–0.90rem | Labels, notas |
| `--text-base` | 0.95–1.02rem | Cuerpo |
| `--text-lg` | 1.08–1.18rem | Subtítulos |
| `--text-xl` | 1.22–1.40rem | Títulos sección |
| `--text-2xl` | 1.50–1.85rem | Títulos página |
| `--text-3xl` | 1.95–2.60rem | KPI principal |
| `--text-4xl` | 2.50–3.60rem | Display |
| `--text-display` | 3.20–5.50rem | Hero largo |
| `--text-hero` | 3.80–7.50rem | Hero máximo |

### Clases utilitarias

- `.font-display` — serif italic, tracking tightest, leading tight. Para titulares hero.
- `.font-editorial` — serif normal, tracking tight. Para subtítulos prominentes.
- `.font-mono` — JetBrains Mono con tnum/ss01. Para datos.
- `.eyebrow` — sans xs, fw-medium, uppercase, tracking widest, ink-2. Para etiquetas de sección.
- `.numeric-tabular` — tnum, tabular-nums. Para tablas de datos.

---

## Espaciado

Escala 4px: `--space-1` (4px) → `--space-32` (128px).
Sección: `--space-section: clamp(4rem, 3rem + 5vw, 9rem)`.

Regla: rhythm no uniforme. Secciones distintas reciben espaciado distinto para crear jerarquía.

---

## Radios

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 3px | Micro chips |
| `--radius-sm` | 5px | Badges, tags |
| `--radius-md` | 8px | Inputs, botones |
| `--radius-lg` | 14px | Tarjetas |
| `--radius-xl` | 20px | Cards grandes |
| `--radius-2xl` | 28px | Modals, overlays |
| `--radius-pill` | 9999px | Pills, avatares |

---

## Sombras

Cálidas (tinte forest, no negras puras):
- `--shadow-xs` / `--shadow-sm` — separación mínima
- `--shadow-md` — tarjetas flotantes
- `--shadow-lg` — modals, cards login
- `--shadow-xl` — overlays máximos
- `--shadow-glow` — glow verde en elementos de acción

---

## Movimiento

### Easings

- `--ease-out-expo` — salidas, hover reveals (0.16,1,0.3,1)
- `--ease-spring` — entradas con overshoot (0.34,1.56,0.64,1)
- `--ease-in-out` — transiciones neutras

### Duraciones

| Token | ms | Uso |
|---|---|---|
| `--duration-micro` | 90 | Hover state, color change |
| `--duration-fast` | 180 | Focus, border |
| `--duration-normal` | 280 | Slide in/out |
| `--duration-editorial` | 520 | Page reveals, stagger |
| `--duration-slow` | 900 | Ambient, float |

### Keyframes globales

- `fadeUp` — entrada desde abajo, usa `.animate-fade-up`
- `fadeIn` — opacidad
- `slideInRight` — entrada desde derecha
- `float` — flotación suave Y
- `orbDrift` — deriva orbital para elementos ambient
- `ringSpin` — rotación anillo decorativo
- `shimmer` — skeleton loading

### Stagger CSS

`.stagger-1` (80ms) → `.stagger-6` (780ms). Para secuencias de entrada.

### Regla reducción de movimiento

Todos los keyframes se desactivan con `prefers-reduced-motion: reduce`. Siempre cumplir.

---

## Layout

- `--max-w-prose` 68ch — columna de texto
- `--max-w-content` 1240px — contenido app
- `--max-w-wide` 1480px — layouts amplios
- `--sidebar-w` 260px
- `--topbar-h` 64px

---

## Componentes

### Button
- `primary` — fondo accent forest, texto blanco
- `secondary` — fondo surface-2, borde border
- `ghost` — transparente, texto ink-2
- `danger` — fondo signal-hi-bg, texto signal-hi
- Tamaños: `sm` / `md` / `lg`

### Card
- Base: `surface-1`, `border`, `radius-lg`, `shadow-sm`
- Accent: borde izquierdo 3px `color-accent`
- StatCard: valor mono + label eyebrow + delta opcional

### Badge
Variants: `low` / `medium` / `high` / `draft` / `submitted` / `validated` / `rejected` / `open` / `calculating` / `under_review` / `locked` / `neutral`
Todos los labels en español.

---

## Identidad de marca

- **Nombre:** EarthLink (nombre propio, no traducir)
- **Tagline:** Trazabilidad climática para tu cadena de suministro
- **Icono:** hoja Lucide sobre fondo accent, esquinas radius-md
- **Paleta primaria:** verde musgo `#1F5C45` (claro) / teal `#4DD0A8` (oscuro)
- **Paleta secundaria:** terracota `#D97757`, mostaza `#C9A14A`
- **Tipografía display:** Instrument Serif italic
- **Tipografía UI:** Inter

---

## Do / Don't

| Do | Don't |
|---|---|
| Usar eyebrow `.eyebrow` antes de secciones | Empezar sección directamente con h2 sin contexto |
| Datos en `--font-mono` con `numeric-tabular` | Datos en sans sin tabular-nums |
| Colores señal solo para semántica | Usar accent verde para decoración genérica |
| Animar solo `transform` y `opacity` | Animar `width`, `height`, `top`, `margin` |
| Respetar `prefers-reduced-motion` | Asumir que todos quieren animaciones |
| Labels en español hardcoded | Añadir librerías i18n |
| Jerarquía por tamaño+peso+espacio | Jerarquía solo por color |
