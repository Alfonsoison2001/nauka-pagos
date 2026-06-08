# Change Proposal — Migración de datos reales: NAUKA Lote 44

> Estado: **PENDIENTE DE APROBACIÓN**. No se escribe el script de migración hasta que Alfonso apruebe este doc.
> Fecha: 2026-06-08
> Tipo: migración de datos one-shot (idempotente, reusable para Lote 3 y Beachfront).
> Prerrequisito cumplido: **backup completo** en `backups/pre-migration-2026-06-08.zip` (restore point).

---

## 1. Objetivo

Importar los datos reales de **NAUKA Lote 44** desde el Excel de Flujo de Pagos a Supabase (prod),
reemplazando la data de prueba actual. Enfoque **híbrido**: el script importa lo tabular
(contratistas, partidas, estimaciones); **Alfonso sube los PDFs de presupuestos firmados manualmente
por la UI** (no se migran archivos).

**En scope:**
- Tablas `contratistas`, `partidas`, `estimaciones` — **solo** del proyecto Lote 44 (`f74c170c-da15-4ee5-a122-4e5dc6b281f3`).
- **Sync/upsert idempotente** por clave natural + soft-delete de la data de prueba ausente del Excel.
- Dry-run obligatorio antes de escribir.

**Fuera de scope (explícito):**
- **PDFs** (presupuestos firmados, carátulas, comprobantes) — Alfonso los sube por la UI.
- `projects`, `firmantes`, `project_firmantes`, `pagadores`, Glosario, Configuración — **ya seedeados**, no se tocan (el script solo **referencia** pagadores por nombre).
- Limpieza de los PDFs de carátula de prueba huérfanos en Storage → **tech-debt de Fase 1**.
- Rotación de keys → diferida a antes de invitar externos (memoria `pre-rotation-security-checklist`).
- Lote 3 y Beachfront → el script queda parametrizable, pero solo se corre L44 aquí.

---

## 2. Fuente

Archivo: `/Users/alfonsoison/Downloads/NAUKA_Flujo_Pagos L44 (1).xlsx` → se copia a
`scripts/migration/lote-44.xlsx` (gitignored) para reproducibilidad.

| Tab | Uso |
|---|---|
| **Presupuesto** | Se lee → `contratistas` + `partidas` (filas reales: B,C,D,E con datos). |
| **Flujo de Pagos** | Se lee → `estimaciones` (filas reales: E,F,I con datos). |
| Configuración / Glosario | **Ignoradas** — proyecto, firmantes y pagadores ya seedeados. |
| Carátula | **Ignorada** — es una plantilla de impresión, no datos. |
| Resumen Total / Resumen Mensual | **Ignoradas** — vistas calculadas; la app las recomputa. |
| `_Aux` | **Ignorada** — hoja auxiliar oculta (dropdowns/array-formulas). |

**Detección de filas reales:** se procesan solo las filas con contratista **y** partida **y** monto/presupuesto
no vacíos. El Excel tiene ~240 filas-plantilla pre-numeradas con fórmulas (montos en blanco / `1900-01-01`)
que **no** se importan.

---

## 3. Decisiones del grill-me (confirmadas)

| # | Tema | Decisión |
|---|------|----------|
| P1 | Modo de import + re-runs | **Sync/upsert** por clave natural (IDs estables, idempotente) + soft-delete de filas de L44 ausentes del Excel. PDFs de prueba quedan huérfanos (tech-debt). El dry-run es la confirmación (sin prompt por borrado). |
| P2 | IVA de estimaciones | `iva_pct = 0`, `monto_sin_iva = "Monto" del Excel` (con-IVA). `monto_con_iva` generado = el Monto exacto. (Las **partidas** sí llevan su 16% real.) |
| P3 | Fecha | `fecha_estimacion = "Fecha de pago"` (col C); fallback a EOM (col B) si C vacía. |
| P4.1 | status | `"Pagado"` → `'pagada'`; otro/vacío → `'pendiente'`. |
| P4.2 | pagador | match por `nombre` (trim, case-insensitive) → global; no-match se marca en dry-run. |
| P4.3 | estimación→partida | resuelve `partida_id` por `(contratista, partida)` nombre exacto (trim). |
| P4.4 | nombres | **verbatim** (incl. typos "Colocaión", "Reubicacion"); solo `trim`. |
| P4.5 | partidas | `presupuesto_sin_iva=D`, `iva_pct=0.16`, generados por DB; `fecha_firma=null`, `presupuesto_pdf_url=null`. |
| P4.6 | estimaciones | `numero=H` verbatim; `concepto=null`, `notas=null`. |
| P4.7 | alcance | solo L44 contratistas+partidas+estimaciones; `projects.ubicacion` se deja `null`. |
| P4.8 | conteos esperados | insertar **6+6+7**; soft-delete **2 contratistas + 2 partidas + 4 estimaciones**. |
| P4.9 | audit_log | registra normal (~20 filas como Alfonso); **no** se suprime. |

---

## 4. Datos reales detectados (lo que se va a importar)

### 4.1 Contratistas (6) — todos nuevos bajo Lote 44
`SAMSTORGAM`, `Hector Triana`, `ABIKAR`, `Urarq`, `Aquaconcepts`, `TENCO`
(rfc / contacto / notas = `null`; el Excel no los trae.)

### 4.2 Partidas (6) — una por contratista
| Contratista | Partida | sin IVA | iva_pct | con IVA (DB genera) |
|---|---|---:|---:|---:|
| SAMSTORGAM | Mecanica de Suelos | 183,440.00 | 0.16 | 212,790.40 |
| Hector Triana | Diseño Estructural | 243,000.00 | 0.16 | 281,880.00 |
| ABIKAR | Colocaión cerca perimetral | 164,800.00 | 0.16 | 191,168.00 |
| Urarq | Derribo y Reubicacion de Arboles | 237,891.04 | 0.16 | 275,953.61 |
| Aquaconcepts | Proyecto Alberca y Jacuzzi | 50,000.00 | 0.16 | 58,000.00 |
| TENCO | Proyecto Instalaciones Especiales | 100,000.00 | 0.16 | 116,000.00 |

### 4.3 Estimaciones (7) — `iva_pct=0`, `monto_sin_iva=monto_con_iva=Monto`, `status='pagada'`, `pagador='Salomon Ison'`
| # | Contratista | Partida | numero | monto | fecha_estimacion |
|---|---|---|---|---:|---|
| 1 | SAMSTORGAM | Mecanica de Suelos | Anticipo | 106,395.20 | 2026-01-23 |
| 2 | Hector Triana | Diseño Estructural | Anticipo | 100,000.00 | 2026-02-01 |
| 3 | ABIKAR | Colocaión cerca perimetral | Anticipo | 90,000.00 | 2026-04-01 |
| 4 | Urarq | Derribo y Reubicacion de Arboles | Anticipo | 90,000.00 | 2026-04-02 |
| 5 | Urarq | Derribo y Reubicacion de Arboles | Finiquito | 185,952.81 | 2026-05-07 |
| 6 | Aquaconcepts | Proyecto Alberca y Jacuzzi | Anticipo | 17,400.00 | 2026-05-07 |
| 7 | TENCO | Proyecto Instalaciones Especiales | Anticipo | 58,000.00 | 2026-05-27 |

### 4.4 Validación cruzada contra el Excel (checkpoints del dry-run)
- **Total ejercido** (Σ estimaciones con-IVA) = **647,748.01** → coincide **exacto** con `Resumen Total!E12` del Excel. ✅
- **Total presupuesto** (Σ partidas con-IVA) = **1,135,792.01** → vs Excel `Resumen Total!D12` = 1,135,792.006 (diff 0.004 por el redondeo a 2 decimales de Urarq; esperado y aceptado en P4.5).

### 4.5 Soft-delete (data de prueba ausente del Excel)
| Tabla | Filas a soft-delete |
|---|---|
| contratistas | `CYVSA` (acf9dfd5…), `R&R Imper` (93422229…) |
| partidas | `Diseño de Ingenieria HVAC` (4e35a498…), `Impermeabilizacion` (6151768d…) |
| estimaciones | bajo 4e35: `Est 1` (986389a9…), `EST 2` (a81c26c3…); bajo 6151: `Est 1` (f7595a75…), `EST 4` (780fa11f…) |

(La estimación `EST 3` 4883be34… ya estaba soft-deleted. La `CYVSA` de **Beachfront** c2ebfbd3… es de otro proyecto, no se toca.)

---

## 5. Mapeo Excel → DB (resuelto; corrige el SPEC §9 desactualizado)

> El SPEC §9 quedó obsoleto: estimaciones ya **no** tiene `fecha_solicitud`/`fecha_pago` (es `fecha_estimacion`), `status` es manual `{pendiente|enviada|pagada}`, y estimaciones tiene `iva_pct` propio con `monto_con_iva` GENERATED.

**`contratistas`** ← Presupuesto col B: `project_id=L44`, `nombre=trim(B)`. Resto `null`.

**`partidas`** ← Presupuesto cols C–E: `contratista_id` (del paso anterior), `nombre=trim(C)`, `presupuesto_sin_iva=D`, `iva_pct=E (0.16)`. `iva_monto`/`presupuesto_con_iva` los genera la DB. `notas=trim(H)|null`, `fecha_firma=null`, `presupuesto_pdf_url=null`.

**`estimaciones`** ← Flujo de Pagos:
| Campo DB | Origen | Nota |
|---|---|---|
| `partida_id` | lookup `(E contratista, F partida)` | exacto, trim |
| `numero` | `H` | verbatim ("Anticipo"/"Finiquito") |
| `monto_sin_iva` | `I` ("Monto", con-IVA) | P2 |
| `iva_pct` | — | `0` (P2) |
| `monto_con_iva` | (generado) | = `I` exacto |
| `pagador_id` | lookup `D` ("Salomon Ison") | global, trim/ci |
| `fecha_estimacion` | `C` (Fecha de pago) | fallback `B` EOM |
| `status` | `M` ("Pagado") | → `'pagada'` |
| `concepto`, `notas` | — | `null` |

---

## 6. Mecánica del script

- **Archivo:** `scripts/migration/migrate-lote-44.mjs` (ESM; corre con `node`, sin tsx). Bloque de config arriba (lote, ruta xlsx, project lookup) para clonar a L3/BF.
- **Dependencia nueva (única):** `pnpm add -D exceljs` para leer el `.xlsx` (pre-autorizada por SPEC §9; es devDependency, no entra al bundle de la app).
- **Auth:** sesión admin vía supabase-js (`BACKUP_ADMIN_EMAIL`/`BACKUP_ADMIN_PASSWORD` en `.env.local`), **no** service_role (sin grants). Mismo mecanismo validado en el backup.
- **Default = DRY-RUN.** `node --env-file=.env.local scripts/migration/migrate-lote-44.mjs` → **no escribe nada**, solo reporta. Escribe **solo** con `--commit` explícito.
- **Idempotencia (sync):**
  - Upsert por clave natural: contratistas `(project_id, nombre)`, partidas `(contratista_id, nombre)`, estimaciones `(partida_id, numero)` — entre filas activas (`deleted_at IS NULL`), que es justo el índice único parcial de cada tabla.
  - Si existe activa → `UPDATE` de campos mutables; si no → `INSERT`.
  - Tras upsert, **soft-delete** (`deleted_at=now()`) de toda fila activa de L44 cuya clave **no** esté en el Excel.
- **Orden:** contratistas → partidas → estimaciones (resolviendo FKs); soft-delete al final.

### Salida del dry-run (lo que revisas antes de `--commit`)
1. **INSERTS** — listado por tabla con valores (6 contratistas, 6 partidas, 7 estimaciones).
2. **UPDATES** — filas que cambiarían (en la 1ª corrida: 0).
3. **SOFT-DELETES** — las 2+2+4 filas de prueba, por nombre + id.
4. **WARNINGS** — pagador/partida sin match, fechas no parseables, conteos ≠ esperado (6/6/7), totales ≠ checkpoints §4.4.
5. **RESUMEN** — `+6 contratistas, +6 partidas, +7 estimaciones, -2/-2/-4 soft-delete; ejercido=647,748.01 (✓ Excel)`.

---

## 7. Plan de ejecución (con tu aprobación entre pasos)

1. **(este doc)** apruebas el openspec.
2. Copio el Excel a `scripts/migration/lote-44.xlsx`; `pnpm add -D exceljs`; escribo el `.mjs`. → te aviso.
3. **Dry-run** → te paso la salida completa (§6). → **revisas y apruebas**.
4. **`--commit`** (escritura real, como Alfonso). 
5. **Validación:** conteos en DB (+6/+6/+7, -2/-2/-4), totales (ejercido 647,748.01), spot-check.
6. **Verificación en la app:** abro Lote 44 → Presupuesto y Flujo de Pagos muestran los 6/7 reales y los acumulados cuadran.
7. Cierre: recordatorio de **borrar `BACKUP_ADMIN_*` de `.env.local`**.

---

## 8. Riesgos y rollback

- **Restore point:** `backups/pre-migration-2026-06-08.zip` (JSON+CSV de las 11 tablas) + esquema en `supabase/migrations/`. Si algo sale mal, se restaura desde ahí.
- **Reversibilidad:** todo es soft-delete (`deleted_at`) o INSERT acotado a L44 — nada destructivo. Un mal import se revierte soft-borrando lo insertado y restaurando `deleted_at` de lo borrado.
- **Gate:** el dry-run (default) hace imposible escribir por accidente; `--commit` es deliberado y revisado.
- **Aislado:** el script toca **solo** `project_id = L44`; los otros 2 proyectos no se ven afectados.

---

*Fin del change proposal. Esperando aprobación de Alfonso para el Paso 2 (escribir el script).*
