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

**Tipos de card (importante):**

1. **Cards estándar (default)** — fondo BLANCO con borde turquesa sutil
   - Card bg: `#FFFFFF`
   - Card border: `1px solid #C9E8E6` (toque turquesa para coherencia con el accent)
   - Card shadow: `0px 4px 20px rgba(22, 61, 74, 0.05)` (toque del azul de marca, no negro)
   - Card radius: `20px`
   - Usar para: hero, composición, tablas, listas, chips, charts, todo lo que no sea KPI principal

2. **KPI Cards principales (variant="dark")** — fondo AZUL OSCURO con número turquesa
   - Card bg: `#163D4A` (NAUKA dark)
   - Card border: none o sutil del mismo color
   - Card shadow: `0px 4px 20px rgba(22, 61, 74, 0.15)` (más fuerte para que destaque)
   - Label: text-xs uppercase tracking-wider color `#7FCFCB` (turquesa, alpha medio)
   - Métrica: text-4xl font-medium color `#7FCFCB` tabular-nums
   - Subtítulo: text-sm color blanco con alpha
   - Usar SOLO para los 4 KPIs principales del Resumen (Presupuesto Total, Ejercido, Disponible, Por pagar) — son los únicos cards con fondo oscuro

**Jerarquía visual:**
- Sidebar gradiente `#163D4A` → `#102C36` (zona oscura ancla la composición a la izquierda)
- Main bg `#F8FAFB` (casi blanco)
- Cards estándar blancas con border turquesa
- 4 KPI cards azul oscuro destacan como "focales" sobre el fondo claro

El contraste es: **2 zonas oscuras (sidebar + KPIs) ancla la atención, todo lo demás flota en blanco**.

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

#### Paleta de chart segments (monocromático azul + gris — NO verde, NO amarillo)

Cuando un chart tenga segmentos para Ejercido / Por pagar / Disponible:
- **Ejercido:** `#7FCFCB` (NAUKA accent — claro, "completado")
- **Por pagar:** `#163D4A` (NAUKA dark — fuerte, "comprometido")
- **Disponible / No comprometido:** `#E5E7EB` (gris claro)

**Importante:** los STATUS BADGES de la app (Pendiente / Enviada / Pagada en tablas y listas) sí mantienen sus colores funcionales (verde Pagada, amber Enviada, gris Pendiente) — la regla monocromática azul aplica SOLO a chart segments.

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

---
---

# EXTENSIÓN — Módulo Buy-Out: tablero financiero denso

**Estado:** 2026-07-03 · rama `feat/ui-profesional` · **Aplicado a: Resumen (piloto, fase 1) +
Partida y Glosario (fase 2).** Pendiente reacción de Alfonso. **Pagos NO se toca.**
**Subcategoría queda EXCLUIDA a propósito** (pantalla por eliminar — rama `feat/buyout-historial`).

## Por qué una extensión (y no otro sistema)

El sistema de arriba (aprobado 01-jun) optimiza *dashboards*: pocas cifras grandes, mucho aire.
El Buy-Out es otra cosa: un **tablero** de ~30 partidas × 8–12 columnas de dinero que se **lee
completo**, como el Excel BUY OUT. Misma marca, mismos tokens — distinta **densidad** y
**jerarquía**. Todo lo que esta extensión no diga, hereda del sistema de Pagos.

## Principios del tablero

1. **Informativo primero** (SPEC-buyout §6): es un tablero para VER, no para capturar. Lo que
   debe saltar a la vista: el Ppto vigente, el DIF, el estado (2 ejes) y la última actualización.
2. **Denso pero legible.** El usuario vive en Excel; más filas por pantalla sin apretar la
   lectura. La densidad sale de la altura de fila y los paddings, NO de encoger la letra.
3. **La tinta es para el dato; el color, para la señal.** El dinero va SIEMPRE en tinta
   (`nauka-dark` / muted). Color solo en señales puntuales: DIF (rojo/verde), barras de avance
   (accent/dark), badges. Nunca colorear una columna entera de montos.
4. **Jerarquía de 5 niveles de tinta** (peso, no tamaño):
   referencia (muted) → dato vivo (`font-medium` dark) → subtotal (`font-semibold` dark) →
   TOTAL (banda oscura, texto blanco) → métricas del pie (colofón).
5. **Cero decoración.** Sin iconos en encabezados de columna, sin zebra stripes, sin bordes
   gruesos. El icono se reserva para AFFORDANCES (lápiz de editar, chevron, ↩ reabrir).
6. **Espejo del Excel intocable:** mismas columnas, mismos labels, mismo orden, mismas
   acciones. El diseño solo cambia cómo se ve, jamás qué dice.

## Paleta (reusa 100% los tokens NAUKA — cero colores nuevos)

- **Superficie de tabla:** card blanca `rounded-2xl` + `border-nauka-card-border` +
  `shadow-nauka-card` (idéntica a las cards de Pagos).
- **Estructura interna:** hairlines `nauka-subtle`; banda de capítulo `nauka-subtle/60` con
  **espina accent de 2px** a la izquierda; lavado de subtotal `nauka-bg`; TOTAL `nauka-dark`.
- **Colores fijos de los 2 ejes de estado** (barras/rellenos, en todo el módulo):
  - **Madurez → accent `#7FCFCB`** (avance hacia "respaldado por cotización")
  - **Contratación → dark `#163D4A`** (avance hacia "amarrado/firmado")
- **DIF** conserva el semáforo financiero: sobre-ppto rojo `nauka-danger` ↑ · bajo verde
  `nauka-success` ↓ · sin dato/~0 gris.
- La **lista negra** de Pagos aplica igual (nada de morados, neones, esmeraldas saturadas).

## Tipografía y números

- **Cuerpo de tabla: `text-sm` (14px)**, Inter. Encabezados de columna y labels de estructura:
  **11px uppercase `tracking-wider`** muted. Notas al pie de pantalla: `text-sm` muted.
- **Dinero:** `tabular-nums` SIEMPRE; **sin decimales** en el tablero (`formatMXN0`, es-MX;
  la BD conserva sus 2 decimales). Los % de DIF con 1 decimal; los % de avance en enteros.
- **Pesos por rol de columna:**
  - referencia (Ppto Base, meses congelados, $/m², proveedor, fechas) → `text-muted-foreground`
  - dato vivo (Ppto vigente, Total) → `font-medium text-nauka-dark`
  - subtotales → `font-semibold text-nauka-dark` · TOTAL → blanco `font-semibold` sobre dark
- Nombre de partida: `font-medium`, tinta base; hover = subrayado `decoration-nauka-accent`
  (el texto NO cambia a accent: contraste insuficiente sobre blanco).

## Espaciado y densidad

- **Celdas `px-3 py-2`**; primera columna `pl-4`, última `pr-4` (la tabla respira hacia el
  borde de la card). Encabezado `py-2.5`.
- **Filas de datos `h-11` (44px)** — vs 56px del dashboard de Pagos. Bandas de capítulo y
  filas de subtotal `py-2`.
- Entre bloques de la pantalla: `gap-4` (el `gap-10` de Pagos es para dashboards, no tableros).

## Radios y sombras

Los de Pagos, sin excepciones: cards `rounded-2xl` · pills/botones/segmented `rounded-full` ·
inputs `rounded-lg`. **Dentro de la tabla no hay sombras** — solo hairlines. (Única sombra
"técnica": el hairline del header sticky se dibuja con `box-shadow` inset porque un `border-b`
en fila sticky se queda atrás al hacer scroll con `border-collapse`.)

## Estructura del tablero (código: `buyout/table-ui.tsx`)

- **Header sticky:** fondo blanco sólido (no banda gris), labels 11px uppercase muted,
  hairline inferior inset. Sin iconos.
- **Banda de capítulo:** `nauka-subtle/60` + espina accent 2px + nombre 11px uppercase dark.
- **Subtotal:** lavado `nauka-bg` (más claro que la banda de capítulo), números `font-semibold`
  cayendo bajo su columna, label 11px uppercase muted.
- **TOTAL:** banda `nauka-dark`, **sticky bottom** — el total general siempre visible mientras
  se scrollea el tablero.
- **Colofón de métricas** (pie del Vigente): franja DENTRO de la card, bajo el TOTAL — como el
  Excel pone COSTO M2 / USD debajo de TOTAL PRESUPUESTO. Label 11px uppercase muted + valor
  `text-lg font-semibold` tabular dark, en línea (`sticky left-0` para sobrevivir el scroll
  horizontal). **Reemplaza a las 4 tarjetas grises sueltas** del pie anterior.
- **DIF:** texto con signo y flecha (↑ rojo · ↓ verde · — gris), `text-xs font-medium`
  tabular, **sin pill de fondo** a nivel fila (menos ruido); en la banda TOTAL, tintas claras.
- **Tabla de 22 columnas (Partida):** mismo header blanco con hairline (estático — ahí el
  scroll vertical es el de la página); la columna **Acciones** va `sticky right-0` con fondo
  sólido y hairline izquierdo → las acciones quedan a la mano aunque se scrollee horizontal;
  su fila Total usa la misma banda `nauka-dark`. Los montos de Partida conservan sus
  2 decimales (formato del tab verde del Excel; el "sin decimales" es del Resumen).
- **Barras de avance** (Estado del Vigente, % Contratado, desglose del TOTAL): track
  `nauka-subtle`, relleno accent (madurez) / dark (contratación), altura 1.5, % en texto muted.

## Estados

- **Hover de fila:** `bg-nauka-bg` plano (sin elevación ni bordes).
- **Activo/selección** (pestañas de modo, toggles): pill `bg-nauka-dark text-white` — nunca
  solo color de texto para marcar el activo. Segmented controls: contenedor `rounded-full`
  borde `nauka-card-border` fondo blanco `p-1`, opción activa pill oscura.
- **Foco teclado:** ring accent (el token `--ring` ya es accent) — no se suprime.
- **Vacío:** texto muted en una línea, sin italic ("Sin partidas en este capítulo"); una
  sección completa vacía = card de borde **dashed** `nauka-card-border` (comunica "aún no").
- **Carga:** las pantallas son Server Components — el estado de carga vive en las ACCIONES
  ("Guardando…", botón disabled), no en spinners de página. Skeletons: solo si algún día hay
  fetch en cliente.

## Badges de estado — los 2 ejes (sistema para todo el módulo)

Forma: pill `rounded-full h-6 px-2.5 text-[11px] font-medium`. **Cada eje usa SU color fijo**
(el mismo de sus barras): madurez → accent · contratación → dark. Los estados "pendientes"
van en gris; el color marca el estado ALCANZADO.

- **Madurez:** `Paramétrico` = outline **dashed** gris (es un estimado tecleado, un borrador) ·
  `Ppto` = tinte accent (`accent/20`, texto dark — respaldado por cotización real).
- **Contratación:** `Contratado` = tinte dark (`dark/10`, texto dark — amarrado) ·
  `No contratado` = neutral (`nauka-subtle`, texto muted).
- **Parcial** (mezcla por dinero): NO lleva badge — se muestran las **micro-barras de % por
  eje** (el % por dinero es el dato real; un badge "Parcial" esconde información).
- En el **Resumen** la columna Estado usa siempre las micro-barras (muestran el % exacto);
  los badges viven en **Partida** (cols PARAMETRICO/PPTO y CONTRATADO/NO CONTRATADO; el de
  contratación es clicable para admin — mismo look, con ring al hover).
- **Indicador "con datos"** (tarjetas de Partida, filas del Glosario): punto `accent`
  (capturado) vs `neutral/40` (vacío). Es dato, no semáforo → color de marca, no verde.

## Qué NO cambia nunca en esta pasada

- Columnas, labels, orden y acciones idénticos (regla del espejo del Excel).
- Cero cambios de datos/queries/rutas/lógica; **Pagos intacto**; sin dependencias nuevas.
- Los formateadores existentes (`formatMXN0`, `formatUSD0`, `formatDate`) son la única fuente
  de formato.
