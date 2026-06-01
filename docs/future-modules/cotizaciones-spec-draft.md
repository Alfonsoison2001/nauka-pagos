# Cotizaciones — Spec Draft (Fase 1 post-MVP)

**Estado:** Draft, capturado durante pivote del 01/06/2026. Retomar después de Día 7.
**Owner del módulo:** Alfonso + Jessica.
**Usuarios:** Solo IZ Arquitectos interno (Alfonso, Jessica, gente de Diseño).

---

## Contexto del problema

Hoy se trackean cotizaciones de los 3 proyectos NAUKA en un Google Sheets (`NAUKA - Estatus Cotizaciones L44-BF-L3.xlsx`) con 3 tabs (uno por proyecto). El sheet tiene:

- 73 columnas de las cuales solo 9 tienen datos reales.
- 4 FASES (UNO/DOS/TRES/CUATRO) que se prepararon pero quedaron vacías — síntoma de intento abandonado de modelar el ciclo completo.
- Campo "Estado Proyecto" como texto libre (no filtrable).
- Cero conexión con el sistema de Pagos (datos duplicados manualmente en tab "Pagos" solo para L44).
- Sin timestamps ni bitácora — cada update pisa la nota anterior.

**El cuello de botella real está en Diseño**, no en negociación ni en pagos. El módulo debe hacer visible eso.

---

## Decisiones cerradas

### Modelo de cotización

- **Multi-cotización por partida.** Una partida puede tener cotizaciones de N proveedores simultáneamente.
- **Multi-versión por proveedor.** Un proveedor puede mandar v1, v2, v3, etc. Cada versión hereda y reemplaza a la anterior (vía `replaces_id`). Historial visible.
- **Sin "Adjudicar" como paso explícito.** El proceso real es: el proveedor manda versiones → una versión gusta → se manda a firmas → firma Marcos Fasja + Jose → esa cotización firmada se convierte en contrato.

### Firmantes de cotización

- **2 firmas requeridas:** Marcos Fasja + Jose.
- Hardcoded por ahora. No configurable.
- Cuando ambas firmas se marcan → cotización pasa a `Firmada` → trigger automático.

### Status ciclo

**Status de cotización:**
- Solicitada
- Recibida
- En ajustes (mientras hay vueltas/versiones)
- Lista para firmas
- En firmas (al menos 1 de 2 firmas marcadas)
- Firmada (ambas firmas marcadas → contrato)
- Rechazada (otra cotización ganó)

**Status de partida:**
- En diseño (Diseño aún no la libera)
- Lista para cotizar (Diseño liberó, sin solicitar cotización aún)
- Cotizando (1+ proveedores cotizando)
- En firmas (versión final mandada a Marcos Fasja + Jose)
- Contratada (hay 1 cotización firmada)
- En ejecución (estimaciones flowing)
- Finalizada (última estimación pagada)

### Transiciones automáticas al firmar

Cuando ambas firmas (Marcos Fasja + Jose) se marcan en una cotización:

1. Cotización pasa a `Firmada`.
2. Partida pasa a `Contratada`.
3. Se crea automáticamente fila en `partidas` actuales (tab Presupuesto) con:
   - Partida: nombre + WBS de la partida_catalogo
   - Contratista: el proveedor de la cotización
   - Monto: el monto de la versión firmada
   - IVA: heredado de la cotización
   - PDF: hereda el archivo de la cotización
   - `cotizacion_id`: FK que liga al origen
4. Las cotizaciones perdedoras (otros proveedores de la misma partida) pasan automáticamente a `Rechazada`.
5. Log de status registra la transición.

**Cero re-captura.**

### Bloqueadores

Mixto: dropdown de categoría + texto libre + quién destrababa.

Categorías iniciales:
- Falta planos
- Falta criterio de diseño
- Falta autorización
- Falta cotización
- Esperando respuesta proveedor
- Esperando entrega anterior
- Otro

Campo `bloqueador_quien` (text): quién destrababa (Jose, Marcos Fasja, Sof, Daniel, proveedor X, etc.). No es un FK porque puede ser cualquiera, interno o externo.

### Responsable de Diseño

Solo gente de Diseño (Sof, Jess, Edy, Daniel). Las autorizaciones de Jose / Marcos Fasja / Salomon NO son responsables, son bloqueadores con `bloqueador_quien`.

### Anticipos

No se modelan anticipos pre-firma. Los anticipos siempre van después de firma como una estimación normal.

### Cambios de status

Libre — cualquier usuario puede mover el status de una partida sin confirmación. No requiere doble click ni aprobación.

### WBS

Hardcoded las 8 categorías iniciales (vienen del Sheet actual):

1. DISEÑOS, INGENIERÍAS Y TOPOGRAFÍA
2. OBRA CIVIL
3. MEP
4. ACABADOS
5. COLOCACIONES
6. ALBERCAS
7. JARDINERÍA Y RIEGO
8. OTROS

Editable: usuario puede agregar más categorías si lo necesita (admin).

### Historial de status (ciudadano de primera clase)

Tabla `partidas_status_log` que registra:
- partida_id
- status_anterior
- status_nuevo
- cambiado_por (FK users)
- cambiado_en (timestamp)
- nota opcional ("por qué cambió")

Permite:
- "Días en cada status" (calculado).
- "Partidas atoradas > N días" (alerta).
- "Esta semana ¿qué se movió?" (reporte).
- "Quién cambió esto y cuándo" (auditabilidad).

---

## Modelo de datos (borrador)

### `partidas_catalogo`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| proyecto_id | FK → proyectos | |
| wbs | text | "3.6" |
| categoria_wbs | enum | "MEP" |
| nombre | text | "Iluminación" |
| responsable_diseno | enum | Sof / Jess / Edy / Daniel |
| status_actual | enum (7 valores) | "En firmas" |
| status_desde | timestamptz | calculado del último cambio |
| bloqueador_categoria | enum nullable | "Falta autorización" |
| bloqueador_quien | text nullable | "Jose" |
| bloqueador_nota | text nullable | "Pidió bajar 5%" |
| fecha_objetivo | date nullable | |
| contrato_id | FK → partidas nullable | NULL hasta firmar |
| created_at, updated_at, deleted_at | timestamps | soft-delete |

### `cotizaciones`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| partida_catalogo_id | FK | |
| proveedor_id | FK → proveedores (promoción de contratistas) | |
| version | integer | 1, 2, 3... |
| replaces_id | FK → cotizaciones nullable | la versión anterior si es ajuste |
| monto_sin_iva, monto_con_iva | numeric(14,2) | |
| iva_pct | numeric default 16 | |
| fecha_solicitada, fecha_recibida | date | |
| archivo_url | text | Supabase Storage |
| status | enum (7 valores) | |
| firmada_por_marcos | timestamptz nullable | |
| firmada_por_jose | timestamptz nullable | |
| notas | text | |
| created_at, updated_at, deleted_at | timestamps | |

### `partidas_status_log`

| Campo | Tipo |
|---|---|
| id | uuid PK |
| partida_catalogo_id | FK |
| status_anterior | enum nullable |
| status_nuevo | enum |
| cambiado_por | FK → users |
| cambiado_en | timestamptz |
| nota | text nullable |

### `partidas_notas`

| Campo | Tipo |
|---|---|
| id | uuid PK |
| partida_catalogo_id | FK |
| autor | FK → users |
| texto | text |
| creado_en | timestamptz |

### View `partidas_timeline`

UNION ALL de status_log + notas + cotizaciones (eventos) ordenado por fecha desc, para mostrar timeline cronológica en el detalle de la partida.

---

## UI / UX

### Vista principal (per-proyecto)

```
Filtros: [Status ▼] [Responsable ▼] [Bloqueador ▼] [Categoría WBS ▼]   [+ Nueva partida]

  1.0 DISEÑOS INGENIERIAS Y TOPOGRAFIA
  ─────────────────────────────────────
  ● Calculo Estructural    En firmas         Sof    Falta firma Jose          →
  ● Mecanica de Suelos     Finalizada        Edy/Jess                          →
  ● Diseño HVAC            Contratada        Jess                              →

  2.0 OBRA CIVIL
  ─────────────
  ● Albañileria y Bardas   En diseño         Jess   Falta planos Triana        →
  ● Impermiabilizacion     Cotizando         Jess                              →
```

Click en partida → drawer lateral.

### Drawer de detalle

- Header con status actual + duración ("● En firmas · hace 4 días").
- Bloqueador con quién + nota.
- Cotizaciones (por proveedor, con versiones colapsables, la vigente expandida).
- Bloque de firmas: ✓ Marcos Fasja / ☐ Jose (con fechas).
- Historial de status (timeline).
- Bitácora (notas timestamped).
- Acciones: cambiar status, agregar nota, agregar cotización, marcar firma.

### Vista cross-project (dashboard)

- Partidas atoradas > N días (configurable).
- Distribución por categoría de bloqueador (los 3 proyectos).
- Velocidad de la semana (avanzaron / adjudicaron / firmaron).
- Por responsable.

---

## Phasing dentro de Fase 1

1. Tablas + RLS + seeds de categorías WBS.
2. Tab "Cotizaciones" per-proyecto con CRUD básico de partidas_catalogo.
3. CRUD de cotizaciones (multi-version, multi-proveedor).
4. Marcar firmas + transición automática a contrato.
5. Historial de status + bitácora.
6. Dashboard cross-project.

Estimado: 1.5–2 semanas si seguimos el ritmo de Días 1-5.

---

## Lo que NO entra en Fase 1

- Notificaciones email a proveedores (Fase 2).
- Generación automática de orden de compra al firmar (Fase 2).
- Comparador side-by-side de cotizaciones (Fase 2).
- Workflow de aprobaciones más complejo (todo libre por ahora).
- CRM cliente-facing (no aplica — sistema solo interno).

---

## Open questions para retomar

- Templates de partidas por proyecto (ej. proyectos NAUKA siempre tienen estas 50 partidas) para no crear desde cero cada proyecto.
- Importar Buy Out de Excel usando las skills `nauka-buy-out-unitarios` / `lote44-buy-out-unitarios` como bootstrap de partidas_catalogo + cotizaciones históricas.
- Permisos por rol (Diseño solo lee, admin edita firmas) — por ahora todo libre.
