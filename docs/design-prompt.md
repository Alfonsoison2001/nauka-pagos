# NAUKA Pagos — Design System Prompt

**Estado:** Aprobado por Alfonso · 01/06/2026 — En aplicación.
**Filosofía:** "A luxury real estate development operating system."

Pensar Apple × Stripe × Foster + Partners × Bjarke Ingels Group.
**NO** pensar contabilidad / ERP / construction software / corporate finance software.

Cada pantalla debe comunicar: **precisión · sofisticación · calma · confianza · elegancia arquitectónica · inteligencia financiera**.

---

## Misión

El dashboard debe sentirse **casi idéntico** a la referencia (`docs/references/dashboard-reference.png` — pendiente de subir), pero conservando branding NAUKA. No es un redesign del layout — es replicar el lenguaje visual.

**Replicar:**
- Overall visual language
- Component styling
- Card design
- Border treatments
- Sidebar styling
- Chart styling
- Spacing rhythm
- Typography scale
- Color usage
- Financial SaaS feel
- Modern fintech aesthetic

**NO copiar:** contenido, layout, branding de la referencia.
**Copiar:** el design language.

---

## Color palette (estricto)

### Marca NAUKA
- **Primary Dark:** `#163D4A` (sidebar bg, números grandes, headings)
- **Primary Accent:** `#7FCFCB` (item activo del sidebar, hover, sparklines, charts)
- **Background:** `#F8FAFB` (área principal — no blanco puro)

### Sidebar (gradiente vertical)
- Top: `#163D4A`
- Bottom: `#102C36`

### Cards y superficies
- Card bg: `#FFFFFF`
- Card border: `1px solid #EEF2F5`
- Card shadow: `0px 4px 20px rgba(0,0,0,0.03)` (las cards deben sentirse como hojas de papel flotando)
- Card radius: `20px`

### Texto
- Primary: `#163D4A` (números grandes y headings) o `#0F172A` (body en main)
- Secondary: `#64748B`
- Muted: `#94A3B8`
- Sobre sidebar oscura: `#FFFFFF` (alpha 100 para activo, alpha 70 para inactivo)

### Funcionales
- Success (Pagada, positivo): `#16A34A`
- Warning (Enviada, en espera): `#F59E0B`
- Danger (sobre-ejercido): `#DC2626`
- Neutral (Pendiente, disponible): `#94A3B8`

### Evitar (lista negra)
- ❌ Morado
- ❌ Azul brillante (azure, electric blue)
- ❌ Colores neón
- ❌ Verdes saturados (limón, lima, esmeralda)
- ❌ Rojos agresivos

Todo debe sentirse **arquitectónico y refinado**.

---

## Layout

### Sidebar permanente a la izquierda
- Ancho: `260px`
- Background: gradiente vertical `#163D4A` → `#102C36`
- Logo NAUKA arriba con padding generoso (~32px top + sides)
- Saludo "¡Hola, Alfonso!" debajo del logo
- Separador sutil
- Menú items:
  - Rounded (`rounded-lg` o `rounded-xl`)
  - Spacious (padding generoso, altura ~44px)
  - Minimal (sin border, sin background por default)
  - Ícono outline (lucide-react)
  - Texto color `#FFFFFF` con alpha
- Item activo:
  - Background: `#7FCFCB`
  - Texto: `#163D4A`
  - Ícono: `#163D4A`
- Footer del sidebar: "Cerrar sesión" pegado abajo

### Main content area
- Background: `#F8FAFB`
- Padding generoso: `px-12 py-10` (más airy que el actual)
- Aumentar whitespace al menos 40% vs estado actual

### Top header de cada página
- Título grande de la página (`text-3xl font-medium` color `#163D4A`)
- Filtros pill-shaped a la derecha (date range, currency, etc.)

---

## Tipografía

Familia: **Inter** o **Geist** (ambas gratis, modernas, soportadas por Next.js fuente)

### Escala
- **Display (números $1.1M):** `text-4xl` o `text-5xl`, `font-medium`, `tabular-nums`, color `#163D4A`
- **H1 página:** `text-3xl`, `font-medium`, color `#163D4A`
- **H2 sección:** `text-xl`, `font-semibold`, color `#163D4A`
- **Body:** `text-sm` o `text-base`, `font-normal`, color `#0F172A`
- **Labels / Uppercase tags:** `text-xs`, `uppercase`, `tracking-wider`, `font-medium`, color `#64748B`
- **Captions / sub-info:** `text-xs`, color `#94A3B8`

**Regla crítica:** la métrica financiera debe **dominar visualmente** la card. Label arriba en pequeño, número GRANDE debajo.

---

## Componentes

### KPI Cards (modernas, no las actuales)

Estructura:
```
[LABEL UPPERCASE PEQUEÑO]
$1,100,000
↑ 8.2% vs estimado    ━━━━━╱╲━━ (sparkline)
```

Specs:
- Background: blanco
- Radius: `20px`
- Border: `1px solid #EEF2F5`
- Shadow: `0px 4px 20px rgba(0,0,0,0.03)`
- Padding: `p-6` o `p-8`
- Label: text-xs uppercase tracking-wider color `#64748B`
- Métrica: text-4xl font-medium color `#163D4A` tabular-nums (DOMINANTE)
- Trend indicator: text-sm + icon (↑↓), color según positivo (success) / negativo (danger)
- Sparkline (opcional): trazo fino color `#7FCFCB`, sin ejes ni grid, opacidad de fill baja

### Cards generales
- Mismas specs que KPI cards (radius, border, shadow)
- "Como hojas de papel flotando" — el border casi se siente invisible

### Botones
- Pill-shaped (`rounded-full`)
- Primary: bg `#163D4A`, text white
- Secondary: outline `#E5E7EB`, text `#163D4A`
- Hover: lighten/darken sutil
- Padding generoso (`px-5 py-2.5`)

### Tablas (SaaS premium, no Excel)
- Sin zebra stripes
- Headers: `text-xs uppercase tracking-wider`, color `#64748B`, padding `py-3`
- Filas: altura generosa (`h-14` o `h-16`), padding por celda generoso
- Dividers: `border-b border-[#EEF2F5]` muy sutil
- Hover effect: bg `#F8FAFB`
- Sticky header al hacer scroll
- Tabular-nums en columnas numéricas
- **Eliminar feel Excel** — más Linear/Stripe que Microsoft

### Badges (status)
- Pill-shaped (`rounded-full`)
- Padding chico (`px-3 py-1`)
- Texto: `text-xs font-medium`
- Colors según función (Pendiente gris-200 / Enviada amber-100+amber-700 / Pagada green-100+green-700)

### Charts (Recharts)
- **Soft y elegante**, no Power BI
- Líneas: thin (stroke 2px), suaves (curva smooth)
- Barras: rounded corners (`radius=[8,8,0,0]` o stacked rounded)
- Gridlines: muy sutiles (`stroke="#EEF2F5"`, dashed o solid alpha bajo)
- Ejes: minimal (sin tick lines, text-xs color `#94A3B8`)
- Tooltip: card blanca, radius `12px`, shadow sutil, border `#EEF2F5`, padding `p-3`
- **Referencia mental:** Stripe / Mercury / Linear (NO Power BI / Tableau / Excel)

### Sparklines (mini chart en KPI cards)
- Sin ejes, sin labels, sin grid
- Trazo color `#7FCFCB`, opacidad de fill baja (~15%)
- Trace fino (stroke 1.5-2)

---

## Spacing y radius (consistencia global)

### Border radius
- Cards: `rounded-2xl` (20px)
- Botones: `rounded-full`
- Inputs: `rounded-lg` (12px)
- Badges: `rounded-full`
- Tooltips: `rounded-xl` (12px)

### Spacing
- Entre secciones: `gap-10` o `space-y-10`
- Padding interno cards: `p-6` (mínimo) / `p-8` (preferido)
- Padding página: `px-12 py-10` en desktop

---

## AI Assistant Panel (futuro, reservar espacio)

La referencia tiene un panel de AI assistant. **No lo construimos ahora**, pero reservamos el espacio visual para Fase futura.

Cuando se construya:
- Card blanca grande con radius `20px`
- Border sutil
- Input grande con prompt placeholder ("¿Cuánto gasté en X?")
- Suggested questions debajo
- Resultados como burbujas de chat o markdown rendered
- Centerpiece del Resumen — el módulo más prominente

---

## Lo que NO se incluye en esta pasada

- ❌ Móvil dedicado / PWA (decisión post-Fase 1)
- ❌ Dark mode (no requerido)
- ❌ Iconos custom (usamos lucide-react)
- ❌ Animaciones complejas (transitions sutiles sí, motion no)
- ❌ AI assistant funcional (solo reservamos espacio visual)

---

## Requisito MÁS importante

Cuando alguien compare el "antes" y "después", el redesign debe sentirse **5–10 años más moderno** y evocar inmediatamente la calidad estética de la referencia, manteniéndose **inequívocamente NAUKA**.

---

## Assets pendientes

- `public/logo-nauka.svg` (o .png) — logo principal, ubicado en sidebar arriba
- `public/logo-nauka-icon.svg` — versión solo ícono para favicons y headers chicos
- `docs/references/dashboard-reference.png` — la imagen de inspiración (MD CASH dashboard) para referencia visual

---

## Plan de aplicación (en fases, una por commit)

1. **Fase 1 — Foundations:** tipografía Inter/Geist via `next/font/google` + Tailwind config con design tokens (colores, shadows, border).
2. **Fase 2 — Layout shell:** componente `<Sidebar />` con gradiente, reemplaza nav horizontal. Main area con bg `#F8FAFB`.
3. **Fase 3 — Páginas en wave:** Login → Resumen → Presupuesto → Flujo → Carátula → Configuración.
4. **Fase 4 — Componentes globales:** KPI cards, tablas SaaS, badges, botones, charts Recharts soft.
5. **Fase 5 — Polish y QA visual:** hover/focus states, spacing rhythm, eliminar feel Excel, QA en cada pantalla.

**Regla crítica:** SOLO se cambia presentación visual. NUNCA se toca lógica de negocio, hooks, server actions, queries, computeResumen, modelo de datos. Toda funcionalidad actual debe seguir funcionando idéntica.
