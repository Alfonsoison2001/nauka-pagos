# Auditoría completa de la app — 2026-07-03

> **Alcance:** TODO el código en `main` (producción), commit `285a6ca`. Módulos Pagos + Buy-Out + Aprobaciones + Auth/Usuarios + esquema/RLS de Supabase (28 migraciones).
> **Método:** lectura directa del código fuente (~175 archivos TS/TSX, 24.7k líneas + 5.7k líneas SQL), verificación de cada hallazgo contra el archivo real. Modo READ-ONLY: **no se cambió código, esquema ni config**.
> **Regla de severidad:** 🔴 crítico (dato financiero incorrecto garantizado o pantalla caída en flujo core) · 🟠 alto (pega a un usuario real en un flujo normal) · 🟡 medio (condicional o latente, silencioso) · ⚪ bajo (borde, mitigado o cosmético-funcional).

---

## Resumen ejecutivo

**Salud general: buena.** La base está bien construida: auth con middleware + `getUser()`, RLS por rol endurecida en tablas *y* Storage, validación Zod cliente+servidor en los formularios principales, guards de admin en las acciones sensibles, soft-delete consistente, triggers de auditoría en todas las tablas, y los fixes de las auditorías previas (BO-01/02/08/09, M1–M3, L1–L3) están aplicados y funcionan. No encontré secretos expuestos, rutas sin auth, ni fugas de datos entre proyectos alcanzables desde la UI.

Los riesgos se concentran en **el módulo Buy-Out recién subido a producción**, específicamente en el caso Beachfront (cotizaciones con varias líneas — una por torre) que los flujos de Historial y puente a Pagos no contemplan, y en **robustez ante fallos parciales** (secuencias multi-escritura sin transacción, errores de Supabase tragados en silencio).

### Top 3 riesgos

1. **🔴 C1 — El Historial y el puente a Pagos usan solo la PRIMERA línea de la cotización.** En Beachfront (donde una cotización tiene una línea por torre), la pantalla Subcategoría muestra hoy un Total MXN de ~la mitad del real, y "Crear contrato en Pagos" / "Re-sincronizar" escribirían ese monto a la mitad en el presupuesto de Pagos. El Resumen y la Partida sí suman bien → los números **no cuadran entre pantallas** y el cuadre con Pagos nace roto para esos conceptos.
2. **🟠 A1 — El cierre de mes usa la fecha UTC del servidor.** Cerrar el mes el último día después de las ~18:00 (hora CDMX) congela la foto en el **mes siguiente** ("2026-07" en vez de "2026-06"). Junio queda sin columna y no hay forma en la UI de cerrar un mes pasado.
3. **🟠 A2 — Editar una línea después de usar el toggle "Contratado" revierte el toggle en silencio.** El formulario de edición congela sus valores al primer render; guardar cualquier corrección re-escribe el estado viejo. Pérdida de estado silenciosa en datos de contratación (aplica también a ediciones concurrentes entre Alfonso y Jess).

---

## Hallazgos

### 🔴 Críticos

#### C1 — Historial/puente a Pagos toman solo la 1ª línea de la cotización (conceptos multi-torre BF muestran/escriben ~la mitad)

- **Archivos:**
  - `src/lib/buyout/history.ts:165` — `if (!out.has(k)) out.set(k, l) // si hubiera varias por quote, la primera` (el historial calcula `montoSinIva`/`totalMxn` de cada versión con UNA sola línea).
  - `src/app/proyectos/[id]/buyout/subcategoria/contrato-actions.ts:73-81` — `loadVigenteContrato` lee el renglón con `.limit(1).maybeSingle()` y calcula el monto del contrato con esa única línea.
- **Contexto:** desde el re-volcado BF agrupado (migraciones `20260629170000+`) y la opción "Dos Torres"/borrado por línea, una `buyout_quote` de Beachfront tiene **varias `buyout_line` vivas** (Torre 1 + Torre 2). El rollup (`loadVigenteLines`/`aggregateLines`) sí suma todas — por eso Resumen, Partida e Índice de conceptos están bien. El Historial y el puente no.
- **Cómo se reproduce:**
  1. Beachfront → Buy-Out → Partida con concepto agrupado por torre (2 líneas en la misma cotización) → "Ver historial".
  2. El panel "Contrato en Pagos" y la tabla de versiones muestran un Total MXN ≈ 50% del que muestran Resumen/Partida/Índice para ese mismo concepto.
  3. (Si además se usa el puente) Marcar Contratado → "Crear/ligar contrato en Pagos": el diálogo confirma la mitad y `partidas.presupuesto_sin_iva` de Pagos se escribe con la mitad. "Re-sincronizar" reafirma la mitad.
- **Impacto real:** montos financieros inconsistentes entre pantallas HOY (sin necesidad de usar el puente); si se usa el puente en BF, el contrato en Pagos queda con presupuesto incorrecto y el cuadre §8 nace descuadrado. L3 no lo sufre (1 línea por cotización).
- **Recomendación (sin implementar):** en `loadItemHistory` y `loadVigenteContrato`, cargar **todas** las líneas vivas de la cotización y sumar (`Σ calcLinea(línea)`, mismo criterio que `aggregateLines`), en lugar de `limit(1)`. En el puente, decidir explícitamente el monto del contrato = suma de líneas de la vigente (y documentar el caso "una torre contratada y la otra no").

---

### 🟠 Altos

#### A1 — Cierre de mes con periodo en UTC: cerrar en la tarde/noche del último día congela el mes equivocado

- **Archivos:** `src/lib/buyout/month-close.ts:16-19` (`currentPeriodo()` usa `new Date()` del servidor — Vercel corre en UTC); consumido por `src/app/proyectos/[id]/buyout/actions.ts:77` (`cerrarMesActual`) y `src/app/proyectos/[id]/buyout/page.tsx:222` (label del botón).
- **Cómo se reproduce:** el 30 de junio a las 19:00 hora CDMX (UTC−6 → 1-jul 01:00 UTC), Evolución → "Cerrar Junio…": el botón ya dice "Cerrar Julio 2026" y la foto se guarda con `periodo = "2026-07"`.
- **Impacto real:** el cierre de mes se hace típicamente el último día por la tarde → la foto cae en el mes siguiente; junio queda sin columna en Evolución y no existe UI para cerrar un mes pasado (solo editar celdas a mano con el lápiz de un mes ya cerrado, que junio no tendría). Corregirlo requiere SQL manual o malabares.
- **Recomendación:** calcular el periodo con `Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" })` (o permitir elegir el periodo en el diálogo de confirmación).

#### A2 — "Toggle Contratado → Editar → Guardar" revierte el toggle (defaults del formulario congelados)

- **Archivos:** `src/app/proyectos/[id]/buyout/partida/linea-dialog.tsx:181-184` (`useForm({ defaultValues: getDefaults(props) })` se evalúa **una sola vez** al montar; el `form.reset` solo corre al cerrar, líneas 187-195) + `contratado-toggle.tsx` (actualiza el server y revalida, pero el dialog ya montado no se re-inicializa).
- **Cómo se reproduce:**
  1. Buy-Out → Partida → fila "No contratado" → clic en el pill → queda "Contratado" (server OK).
  2. Sin salir de la página, clic en ✎ Editar la misma línea → el campo Contratación muestra "No contratado" (valor viejo).
  3. Corregir cualquier otra cosa (p. ej. cantidad) → Guardar → `updateLinea` escribe `contratado = no_contratado`: **el toggle se revierte sin aviso**.
- **Impacto real:** pérdida/reversión silenciosa de estado de contratación (el dato que alimenta % contratado y el puente). El mismo patrón permite pisar cambios hechos por el otro admin entre el render y la apertura del diálogo. `estimacion-dialog.tsx` (Pagos) comparte el patrón con menos vectores prácticos.
- **Recomendación:** re-sincronizar al ABRIR (`form.reset(getDefaults(props))` cuando `open` pasa a `true`), o montar el `LineaDialog` solo mientras está abierto, o `key` derivada de los datos de la línea.

---

### 🟡 Medios

#### M1 — Cap de 1000 filas de PostgREST sin paginar en todo el módulo Pagos (truncado silencioso, latente)

- **Archivos:** `src/app/proyectos/[id]/flujo-de-pagos/page.tsx:97-106` (estimaciones), `src/app/proyectos/[id]/resumen/page.tsx:80-86`, `src/app/proyectos/[id]/caratula/page.tsx:99-106`, `src/app/page.tsx:99+` (Consolidado), `src/lib/approvals/fetch.ts:92-118` (bandeja de aprobaciones, sin filtro ni límite).
- **Detalle:** ninguna de esas queries pagina; PostgREST trunca a 1000 filas **en silencio**. Buy-Out ya lo resolvió (`fetchAllRows` en `src/lib/buyout/rollup.ts:184-195`, que además documenta el caso BF con 1,732 líneas); Pagos no.
- **Impacto real:** hoy no pega (volúmenes chicos), pero el día que un proyecto pase 1,000 estimaciones, Flujo/Resumen/Consolidado mostrarán acumulados y KPIs menores a los reales sin ningún aviso — y por el `order asc` del Flujo se perderían justamente las filas más recientes.
- **Recomendación:** reutilizar el patrón `fetchAllRows` (o `.range()` paginado) en las 5 queries listadas.

#### M2 — "Actualizar presupuesto" y "Eliminar línea" no son atómicos: un fallo a medias deja al concepto sin vigente (desaparece del rollup)

- **Archivos:** `src/app/proyectos/[id]/buyout/partida/actions.ts:245-314` (`insertVigenteQuoteAndLine`: baja la vigente anterior → inserta la nueva → inserta la línea, tres escrituras sin transacción; si la 2ª o 3ª falla, el concepto queda sin vigente o con vigente sin renglón) y `:562-591` (`deleteLinea` pasos de promoción de la versión previa con `await` sin revisar `error`).
- **Cómo se reproduce:** "↻ Actualizar presupuesto" y que el insert de la cotización o del renglón falle (error de red/DB a media secuencia) → el concepto desaparece de Resumen y Partida sin aviso (el error sí se muestra en el diálogo, pero el estado ya quedó cojo). Recuperable a mano desde el Historial ("Marcar vigente").
- **Contexto:** es exactamente el problema BO-09 que ya se arregló para "Marcar vigente" con la RPC atómica `buyout_mark_vigente` — pero no se aplicó a estas dos rutas.
- **Recomendación:** mover el swap de `addBudgetVersion` y la promoción de `deleteLinea` a RPCs plpgsql (una transacción), como BO-09.

#### M3 — "Resumen Mensual" es un stub en producción con texto de desarrollo

- **Archivo:** `src/app/proyectos/[id]/resumen-mensual/page.tsx:1-8` — la pestaña (tab 5 de 6, espejo del Excel) muestra: *"Día 6 construye esto (agregado mensual de pagos)."*
- **Impacto real:** cualquier usuario que entre a la pestaña ve una pantalla vacía con una nota interna del plan de build. No truena, pero es una promesa de la nav que no cumple y el texto es críptico para Jess/aprobadores.
- **Recomendación:** construir la vista (el `computeResumen`/datos ya existen) o, mientras tanto, un empty-state en lenguaje de usuario ("Próximamente…" sin jerga de días de build).

#### M4 — Errores de Supabase tragados en lecturas: un fallo de red pinta el tablero en $0 sin aviso

- **Archivos:** `src/lib/buyout/rollup.ts:184-195` — `fetchAllRows` solo usa `data`; si una página devuelve error, `data=null` → lote vacío → **corta la paginación y devuelve filas parciales** como si fuera todo. Patrón generalizado: casi todos los SELECT de páginas server (`const { data } = await sb...`) ignoran `.error` y renderizan el estado vacío.
- **Impacto real:** un error transitorio de Supabase (red, timeout) se presenta como tablero Buy-Out en ceros / listas vacías, indistinguible de "no hay datos". En una app financiera, "se ve en $0" es peor que "error visible". (`contrato-actions.ts` ya hace esto bien — BO-08 — revisando cada `.error`.)
- **Recomendación:** en `fetchAllRows`, lanzar/propagar si `error != null`; en las páginas clave (Resumen Buy-Out, Flujo, Resumen Pagos), distinguir error de vacío (mensaje "No se pudo cargar, recarga la página").

#### M5 — Tipos de cambio: sin UI para configurarlos, mensaje que apunta a una pantalla inexistente y display inconsistente ante TC faltante

- **Archivos:**
  - No existe ninguna action/pantalla que escriba `buyout_fx` (solo lecturas: `buyout/actions.ts:87`, `buyout/page.tsx:126`, `partida/page.tsx:99,363`, `subcategoria/page.tsx:51`, `contrato-actions.ts:85`). Solo L3 y BF tienen seeds; L44/proyectos nuevos no tienen monedas (el dropdown de Moneda queda vacío y todo cae al default MXN).
  - `contrato-actions.ts:105` — el error dice "Configúralo en Buy-Out antes de crear…" pero esa configuración no existe en la app.
  - Display inconsistente si un TC faltara: Resumen muestra **"$0"** (`rollup.ts:254-257` devuelve `NaN` y `formatMXN0` lo colapsa con `value || 0`, `src/lib/buyout/format.ts:18-20`), la tabla verde muestra **"$NaN"** (`formatMXN` sin guard, `partida/page.tsx:532-534`), y el Historial **finge TC=1** (`history.ts:95-96` `?? 1` — contradice el fix BO-01 del rollup).
- **Impacto real:** hoy contenido (L3/BF sembrados, dropdown limita a monedas existentes), pero cualquier divisa sin TC produce tres verdades distintas en tres pantallas, y el admin no tiene ninguna forma de arreglarlo desde la app.
- **Recomendación:** mini-CRUD de `buyout_fx` (p. ej. en el Glosario), unificar el fallback del Historial al criterio BO-01 (no fingir TC=1), y mostrar "—"/aviso en vez de $0/$NaN.

#### M6 — Pagadores en Configuración: errores tragados — duplicados y correos inválidos fallan en silencio

- **Archivos:** `src/app/proyectos/[id]/configuracion/actions.ts:137-146` (`addProjectPagador` ignora el resultado del insert; un nombre duplicado viola `pagadores_project_nombre_uidx` y no pasa nada visible), `:152-164` (`updatePagadorEmail` hace `return` silencioso si el correo es inválido y tampoco revisa el error del update).
- **Cómo se reproduce:** Configuración → Pagadores → agregar un pagador con nombre ya existente → el form se limpia y no aparece nada, sin mensaje. O teclear un correo con typo ("juan@") → "Guardar" → parece guardado (el input conserva el texto) pero no se guardó.
- **Impacto real:** el correo del pagador es el destinatario de la carátula — un "guardado" fantasma significa que la solicitud de pago no le llega a quien debía.
- **Recomendación:** devolver `{error}` desde las tres actions y mostrarlo (mismo patrón que `FirmantesSection`, que sí lo hace bien).

#### M7 — Guard de "aprobación en curso" bypasseable: "Generar carátula" y editar la partida siguen abiertos durante la ronda

- **Archivos:** `src/app/proyectos/[id]/caratula/caratula-detail-dialog.tsx:178` (el botón "Generar carátula" queda habilitado con ronda abierta y llama `generarCaratula`, que no tiene guard — `caratula/actions.ts:32-63`; solo `regenerarCaratula:334-353` y `updateEstimacion` lo tienen); `src/app/proyectos/[id]/presupuesto/actions.ts:181-224` (`updatePartida` puede cambiar el presupuesto sin guard de aprobación).
- **Cómo se reproduce:** enviar carátula a aprobación → (misma pantalla) clic "Generar carátula" → se regenera y sobrescribe `_generada.pdf` (el preview que revisan los firmantes) sin el candado que "Regenerar" sí respeta. O: Presupuesto → editar la partida → cambiar el monto → el acumulado/PPTO del PDF que se apruebe después ya no corresponde a lo que se envió.
- **Impacto real:** los firmantes pueden terminar aprobando un PDF distinto del vigente; inconsistencia del candado que el propio producto promete ("los firmantes verán un PDF desactualizado").
- **Recomendación:** aplicar el mismo guard de ronda abierta a `generarCaratula` (o esconder el botón como con Regenerar) y evaluar el guard en `updatePartida` cuando la partida tenga carátulas en aprobación.

#### M8 — Editar una estimación fuerza el IVA a 16%/0% y puede re-escribir IVAs distintos en silencio

- **Archivos:** `src/app/proyectos/[id]/flujo-de-pagos/estimacion-dialog.tsx:81` (`agregar_iva: e.iva_pct > 0`) y `:141` (`const ivaPct = values.agregar_iva ? 0.16 : 0`).
- **Cómo se reproduce:** una estimación con `iva_pct` ≠ 0.16 (posible: las partidas de Pagos aceptan IVA 0–100, p. ej. 8% fronterizo, y el puente Buy-Out hereda el `iva_pct` de la línea, que también es libre) → abrir Editar → corregir cualquier campo → Guardar → el IVA queda en 16% sin aviso y `monto_con_iva` cambia.
- **Impacto real:** el total con IVA de la estimación deja de cuadrar con el contrato/carátula. Latente mientras todo sea 16%.
- **Recomendación:** preservar el `iva_pct` original al editar (checkbox solo para alternar 0 ↔ valor original) o exponer el % como campo.

---

### ⚪ Bajos

#### B1 — Invitación de usuario a medias: si falla el insert del perfil, el auth.user queda huérfano sin ruta de reparación
`src/app/usuarios/actions.ts:60-83`. `inviteUserByEmail` crea el usuario; si el insert en `profiles` falla, reintentar da "User already registered" y no hay UI para adjuntar el perfil al usuario ya creado. **Recomendación:** al fallar el perfil, detectar el auth.user existente por email y crear solo el perfil.

#### B2 — Alta de partida (Pagos): la fila se crea antes del upload del PDF; si el upload falla, el reintento choca con "duplicate key"
`src/app/proyectos/[id]/presupuesto/actions.ts:142-171`. El usuario ve "Error subiendo PDF", asume que nada se guardó, reintenta → error crudo de índice único `(contratista_id, nombre)`. **Recomendación:** mensaje explícito ("la partida sí se creó; reintenta el PDF desde Editar"), como ya hace el buy-out (BO-10).

#### B3 — Botones "Ver PDF/comprobante" fallan en silencio si el archivo no existe o la URL firmada falla
`flujo-de-pagos/comprobante-cell.tsx:66-74`, `buyout/partida/buyout-pdf-cell.tsx:14-20`, `presupuesto/pdf-cell.tsx` (mismo patrón `if (url) window.open(...)` sin rama de error; las actions `getSignedPdfUrl`/`getComprobanteSignedUrl` ignoran `.error`). Clic → spinner breve → nada. **Recomendación:** `else` con mensaje ("No se encontró el archivo").

#### B4 — Enviar a aprobación no atómico: ronda creada sin votos si falla el 2º insert
`src/app/proyectos/[id]/caratula/actions.ts:224-247`. Quedaría una ronda "en aprobación" sin firmantes que bloquea reenvíos (salida: Cancelar solicitud). **Recomendación:** RPC transaccional o borrar la ronda si el insert de votos falla.

#### B5 — `fn_create_notification` ejecutable por cualquier autenticado: notificaciones falsificables
Migración `20260615201623_add_notifications.sql:66` (GRANT EXECUTE a `authenticated`). Un aprobador podría insertar notificaciones con título/link arbitrarios a cualquier usuario (p. ej. "Carátula aprobada" falsa con deep-link externo convertido a relativo). Mitigado por el círculo de confianza interno. **Recomendación:** validar `p_type` contra la lista conocida y/o restringir a flujos con verificación interna.

#### B6 — Cierre de mes no atómico: la foto previa se soft-deletea antes de insertar la nueva
`src/app/proyectos/[id]/buyout/actions.ts:124-155`. Un fallo entre ambas escrituras deja el mes cerrado con foto vacía (Evolución en $0 para ese mes). Recuperable re-cerrando. **Recomendación:** RPC transaccional (o insertar antes de bajar).

#### B7 — La campana de notificaciones no recarga la lista al reabrir
`src/components/notifications/notifications-bell.tsx:41-49` (`if (next && items === null)`): tras la primera carga, reabrir muestra la lista cacheada — no-leídas ya leídas y sin las nuevas, aunque el badge (server) sí cambie. **Recomendación:** recargar al abrir siempre.

#### B8 — `updateLinea` sin scoping de proyecto ni guard admin explícito
`src/app/proyectos/[id]/buyout/partida/actions.ts:435-504`, inconsistente con los fixes L1 (`deleteLinea`) y L2 (`setLineaContratado`). RLS admin-global mitiga la escritura; el riesgo residual es bajo (ids cruzados entre proyectos por manipulación). **Recomendación:** replicar el scoping L1/L2.

#### B9 — Editar una línea cuya Villa/Casita no está en el catálogo la pierde al guardar
`linea-dialog.tsx:120-124`: en modo villa, si `villa_casita` no matchea un `buyout_unit` por nombre exacto (valor legacy o unidad renombrada), el default cae a "—" y al guardar se escribe `null` sin aviso. En modo torre (BF) sí se conserva el valor legacy (`withCurrent`). **Recomendación:** aplicar el mismo `withCurrent` a la rama villa.

#### B10 — `numeroALetras` produce "UNDEFINED" con montos ≥ $1,000 millones
`src/lib/format/numero-a-letras.ts:87-99` (`hundreds(millones)` con `millones > 999` indexa fuera de `CENTENAS`). Fuera del rango práctico de una estimación; la letra saldría corrupta en la carátula. **Recomendación:** soportar "mil millones" o clamp con aviso.

#### B11 — `resolveSupplier` usa `ilike` sin escapar `%`/`_`
`src/app/proyectos/[id]/buyout/partida/actions.ts:136-141`: un nombre de proveedor con `%` o `_` actúa como comodín y puede reusar un proveedor equivocado en vez de crear el nuevo. **Recomendación:** escapar el patrón o comparar con `eq` sobre nombre normalizado.

---

## Tabla priorizada

| # | Sev. | Hallazgo | Dónde | Lo pega el usuario… | Esfuerzo aprox. |
|---|------|----------|-------|---------------------|-----------------|
| C1 | 🔴 | Historial/puente a Pagos usan solo la 1ª línea (BF multi-torre = ~mitad del monto) | `lib/buyout/history.ts:165` · `subcategoria/contrato-actions.ts:73-81` | Hoy, en cualquier concepto BF de 2 torres (pantalla) y al crear contrato en Pagos | Medio |
| A1 | 🟠 | Cierre de mes en UTC congela el mes equivocado | `lib/buyout/month-close.ts:16-19` | Cada fin de mes cerrando después de ~18:00 CDMX | Bajo |
| A2 | 🟠 | Toggle Contratado → Editar → Guardar revierte el estado | `buyout/partida/linea-dialog.tsx:181-195` | Al corregir una línea justo después de togglear (o con 2 admins) | Bajo |
| M1 | 🟡 | Cap 1000 PostgREST sin paginar en Pagos (Flujo/Resumen/Carátula/Consolidado/Aprobaciones) | `flujo-de-pagos/page.tsx:97` y 4 más | Latente — al pasar 1,000 estimaciones, truncado silencioso | Bajo-Medio |
| M2 | 🟡 | Nueva versión / borrar línea sin transacción → concepto sin vigente desaparece del rollup | `buyout/partida/actions.ts:245-314,562-591` | Solo ante fallo de DB a media secuencia (recuperable) | Medio |
| M7 | 🟡 | "Generar carátula" y editar partida burlan el candado de aprobación | `caratula-detail-dialog.tsx:178` · `presupuesto/actions.ts:181` | Al regenerar/editar montos con ronda abierta | Bajo |
| M6 | 🟡 | Pagadores: duplicados y correos inválidos fallan en silencio | `configuracion/actions.ts:137-164` | Al capturar/corregir el correo del pagador | Bajo |
| M5 | 🟡 | FX sin UI + display inconsistente ($0 / $NaN / TC=1) ante TC faltante | `history.ts:95` · `format.ts:18` · sin CRUD de `buyout_fx` | Divisas en proyectos sin seed (L44/nuevos) | Medio |
| M8 | 🟡 | Editar estimación fuerza IVA a 16%/0% | `estimacion-dialog.tsx:81,141` | Solo con IVAs ≠ 16% (hoy raro) | Bajo |
| M3 | 🟡 | Resumen Mensual = stub con texto de developer | `resumen-mensual/page.tsx` | Cada vez que alguien abre la pestaña | Medio (feature) |
| M4 | 🟡 | Errores de lectura tragados → tablero en $0 indistinguible de vacío | `lib/buyout/rollup.ts:184-195` + patrón general | Ante fallos transitorios de Supabase | Medio |
| B1-B11 | ⚪ | 11 hallazgos de borde (ver sección) | — | Casos raros / mitigados | Bajo c/u |

---

## Lo que se revisó y salió limpio

- **Auth/middleware:** protección de rutas completa, `getUser()` (no `getSession`), open-redirect bloqueado en `/auth/callback` y `/auth/confirm`, política de contraseñas server-side, magic link con `shouldCreateUser:false` y origen fijo (fix A3 aplicado).
- **RLS:** tablas Pagos y Buy-Out con SELECT autenticado / escritura solo `is_admin()`; Storage endurecido igual (fix A1 aplicado); `profiles` y `notifications` correctamente acotadas; desactivación de usuario con ban de Auth (fix M3 aplicado).
- **Aislamiento entre proyectos y módulos:** todas las queries de páginas filtran por `project_id` (directo o vía cadena contratista→partida); el Buy-Out solo toca Pagos por el puente explícito (BO-02 protege partidas manuales de Pagos contra adopción/sobrescritura); catálogo de partidas per-proyecto correcto tras `20260629130000`.
- **Consistencia Resumen ↔ Partida ↔ cierre de mes (Buy-Out):** una sola fuente (`loadPartidaAggs`) — cuadran por construcción; Contingencias fuera del TOTAL de forma coherente en las 3 vistas y en Evolución.
- **Matemática de Pagos** (`computeResumen`, acumulados del Flujo, carátula con/sin IVA y acumulado ≤ fecha): consistente con el modelo del Excel; divisiones por cero protegidas.
- **Carátula "Propietario: [contratista]"**: verificado contra `reference/NAUKA_Flujo_Pagos.xlsx` (hoja Carátula, A2/B2) — el Excel original hace lo mismo; la app es espejo fiel, no es bug.
- **Doble-submit:** todos los diálogos deshabilitan sus botones con `useTransition` mientras hay una acción en curso.
- **Falsos positivos descartados durante la verificación** (para no re-investigarlos): `ApproveRejectDialog` no tiene doble-submit (useTransition rehabilita al terminar); `readAt: "x"` en la campana nunca se parsea (solo truthy); `getLastProjectId` no usa JSON.parse (no puede tronar).

---

*Auditoría generada el 2026-07-03 sobre `main@285a6ca`. Ningún archivo de código/esquema/config fue modificado; este reporte es el único entregable.*
