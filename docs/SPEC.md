# NAUKA Pagos — System Specification

> **For:** IZ Arquitectos (Alfonso + Jessica)
> **Purpose:** Web app to manage budgets, estimaciones (carátulas) and payments across 3 NAUKA projects (Lote 3, Lote 44, Beachfront).
> **Status:** v0 — ready to paste into Claude Code as initial context.

---

## 1. Goals & Non-Goals

### Goals

- Replace 3 parallel Excel/Sheets files with a single web app.
- Capture signed presupuestos (PDFs) once, never lose them.
- Generate carátulas (estimation cover sheets) as PDFs with one click.
- Auto-email carátulas to admins + selected firmante on send.
- Track payment status (Pagado / Pendiente) per estimación.
- Store proof-of-payment (comprobante) per estimación.
- Consolidated dashboard across all 3 projects.

### Non-Goals (explicit "no" — resist scope creep)

- Mobile native app. (Responsive web is enough.)
- E-signature integration (DocuSign, FIEL SAT, etc.).
- Push notifications, SMS, WhatsApp integration.
- OCR / data extraction from uploaded PDFs.
- Integration with accounting software (Contpaqi, SAT CFDI, etc.).
- Role-based permissions beyond "admin = full access".
- Real-time collaboration features beyond Supabase realtime sync.

---

## 2. Users

| User | Role | Access |
|---|---|---|
| Alfonso | admin | Full |
| Jessica | admin | Full |

**Auth:** Email + password (Supabase Auth, no magic links).

---

## 3. Data Model

### `projects`
The 3 NAUKA projects (Lote 3, Lote 44, Beachfront).

```sql
id              uuid primary key
nombre          text          -- "NAUKA Lote 3"
lote            text          -- "Lote 3"
cliente         text          -- "NAUKA"
ubicacion       text          -- free text (e.g., "Beach Front Residences")
logo_url        text nullable
caratula_iva_mode  text       -- "con_iva" | "sin_iva"
default_emails  text[]        -- default CC list when sending carátulas
status          text          -- "activo" | "cerrado" | "archivado"
created_at      timestamptz
updated_at      timestamptz
```

### `firmantes`
Global library. People who can sign carátulas across projects.

```sql
id              uuid primary key
nombre          text
cargo           text
empresa         text
email           text
firma_url       text nullable -- signature image PNG
created_at      timestamptz
```

### `project_firmantes`
Junction. Which firmantes can sign for each project + order.

```sql
project_id      uuid references projects
firmante_id     uuid references firmantes
orden           int           -- 1, 2, 3
default_signs   bool
primary key (project_id, firmante_id)
```

### `pagadores`
Who actually pays (Salomon Ison, Fasja, NAUKA, Otros).

```sql
id              uuid primary key
nombre          text
project_id      uuid nullable references projects  -- null = global
```

### `contratistas`
Per project.

```sql
id              uuid primary key
project_id      uuid references projects
nombre          text
rfc             text nullable
contacto_nombre text nullable
contacto_email  text nullable
contacto_telefono text nullable
notas           text nullable
created_at      timestamptz
```

### `partidas`
A signed contract between IZ and a contratista.

```sql
id              uuid primary key
contratista_id  uuid references contratistas
nombre          text
presupuesto_sin_iva  numeric(14,2)
iva_pct         numeric(5,4)  -- e.g., 0.16
iva_monto       numeric(14,2) -- generated
presupuesto_con_iva  numeric(14,2) -- generated
notas           text nullable
fecha_firma     date nullable
presupuesto_pdf_url  text nullable
created_at      timestamptz
```

### `estimaciones`
A payment request. Each row = one carátula = one pago.

```sql
id              uuid primary key
partida_id      uuid references partidas
numero          text          -- "Anticipo", "Est 1", "Finiquito"
concepto        text nullable
monto_sin_iva   numeric(14,2)
iva_monto       numeric(14,2) -- generated
monto_con_iva   numeric(14,2) -- generated
pagador_id      uuid nullable references pagadores
fecha_solicitud date
fecha_pago      date nullable
status          text          -- "pendiente" | "pagada"
caratula_generada_url  text nullable
caratula_firmada_url   text nullable
comprobante_pago_url   text nullable
caratula_enviada_at    timestamptz nullable
destinatarios_email    text[] nullable
firmantes_seleccionados uuid[] nullable
notas           text nullable
created_at      timestamptz
updated_at      timestamptz
```

### `audit_log`
Automatic via Postgres trigger.

```sql
id              uuid primary key
user_id         uuid references auth.users
action          text          -- "create", "update", "delete"
entity_table    text
entity_id       uuid
before          jsonb nullable
after           jsonb nullable
created_at      timestamptz
```

### Storage buckets (Supabase Storage)

```
proyectos/{project_id}/logo.png
proyectos/{project_id}/presupuestos/{partida_id}.pdf
proyectos/{project_id}/caratulas/{estimacion_id}_generada.pdf
proyectos/{project_id}/caratulas/{estimacion_id}_firmada.pdf
proyectos/{project_id}/comprobantes/{estimacion_id}.{ext}
firmas/{firmante_id}.png
```

All buckets private. Access via signed URLs from Next.js server actions.

### RLS

- All authenticated users (Alfonso, Jessica) have full CRUD.
- Hard-delete blocked by RLS — use `deleted_at` soft delete.

---

## 4. Authentication

Supabase Auth con email + password.
- Sign-in screen at `/login`.
- Reset password via email.
- Bootstrap: invite Alfonso + Jessica via Supabase dashboard.
- Auth middleware in Next.js protects all routes except `/login`.

---

## 5. UI Screens (MVP)

App-level navigation (top bar): NAUKA logo · Project selector (3 NAUKA projects) · Consolidado link · user avatar.

Inside a project, sub-nav with these 6 tabs **in this exact order** (mirrors the Excel tabs 1:1):

1. **Resumen** (= Excel tab "Resumen Total")
2. **Presupuesto** (= Excel tab "Presupuesto")
3. **Flujo de Pagos** (= Excel tab "Flujo de Pagos")
4. **Carátula** (= Excel tab "Carátula")
5. **Resumen Mensual** (= Excel tab "Resumen Mensual")
6. **Configuración** (= Excel tabs "Configuración" + "Glosario" fusionados)

Plus a top-level **Consolidado** view across all projects (replaces "abrir 3 archivos y sumar").

Plus drill-down screens:
- `/estimaciones/[id]` — detail with PDF preview + actions
- `/firmantes` — global library

> Diseño visual de cada pantalla se definirá después en `design-prompt.md` (intencionalmente pospuesto para enfocar primero en estructura/funcionalidad).

---

## 6. Key Workflows

### A. Capturar un presupuesto firmado

1. `/proyectos/[id]` → tab Presupuesto → "Subir presupuesto firmado".
2. Selecciona contratista (o crea uno nuevo).
3. Llena: nombre partida, presupuesto sin IVA, IVA % (default 16).
4. Sube PDF del presupuesto firmado.
5. Sistema calcula IVA monto y total con IVA. Guarda en DB + sube PDF a Storage.

### B. Crear y mandar una carátula

1. `/proyectos/[id]` → tab Carátula.
2. Selecciona partida → contratista se auto-llena.
3. Captura: número, concepto, monto sin IVA, fecha, pagador.
4. Multi-select de firmantes que aparecerán en la carátula.
5. Click "Generar y enviar".
6. Sistema genera PDF con `@react-pdf/renderer`, lo guarda en Storage, y manda correo con Resend.
7. La estimación queda en status "pendiente".

### C. Recibir carátula firmada de regreso

1. Abre la estimación → "Subir carátula firmada".
2. Sube el PDF firmado. `caratula_firmada_url` se actualiza.

### D. Registrar pago realizado

1. Abre la estimación → "Marcar como Pagada".
2. Modal: fecha de pago + upload comprobante.
3. `status = 'pagada'`.

---

## 7. PDF Generation (Carátula)

Library: **@react-pdf/renderer**.

```ts
type CaratulaProps = {
  project: { nombre, lote, ubicacion, cliente, logo_url, caratula_iva_mode }
  contratista: { nombre }
  partida: { nombre, presupuesto_sin_iva, presupuesto_con_iva }
  estimacion: { numero, monto_sin_iva, monto_con_iva, fecha_solicitud }
  acumulado_hasta_aqui: number   // SUMIFS de la misma partida con fecha <= fecha_solicitud
  firmantes: Array<{ nombre, cargo, empresa, firma_url?: string }>
}
```

---

## 8. Email (Resend)

- From: `caratulas@izarquitectos.mx` (usa onboarding domain de Resend al inicio si no hay DNS).
- Subject: `[NAUKA {Lote}] Solicitud de pago Est. {numero} — {contratista}`
- Body: React Email template + PDF adjunto.

---

## 9. Migration Plan

> **CRITICAL FOR SCHEMA DESIGN:** Read this section BEFORE writing any SQL migration. The schema MUST be migration-friendly. Alfonso has 3 Google Sheets (one per project: NAUKA Lote 3, Lote 44, Beachfront), each with the same 6-tab structure as `reference/NAUKA_Flujo_Pagos.xlsx`. These Excels will be the seed data for production. Use the column mappings below as the source of truth when naming and typing DB columns.

### Excel → DB column mappings

#### Tab `Configuración` → `projects` row + `firmantes` + `project_firmantes`

| Excel cell | DB target |
|---|---|
| `C7` (Nombre del Proyecto) | `projects.nombre` |
| `C8` (Ubicación) | `projects.ubicacion` |
| `C9` (Cliente) | `projects.cliente` |
| Rows `B13:D15` (3 firmantes) | `firmantes` rows (global, deduped by email) + `project_firmantes` join with `orden = 1..3` |

#### Tab `Glosario` → `pagadores`

| Excel cell | DB target |
|---|---|
| `C6:C9` (Salomon Ison, Fasja, Nauka, Otros) | `pagadores.nombre`, `project_id = null` (global pagadores) |

#### Tab `Presupuesto` → `contratistas` + `partidas`

| Excel col | DB target |
|---|---|
| `B` (Contratista) | `contratistas.nombre` (dedupe by `(project_id, nombre)`) |
| `C` (Partida) | `partidas.nombre` |
| `D` (Presupuesto sin IVA) | `partidas.presupuesto_sin_iva` |
| `E` (IVA %) | `partidas.iva_pct` |
| `F` (IVA monto) | `partidas.iva_monto` — let DB generate |
| `G` (Total con IVA) | `partidas.presupuesto_con_iva` — let DB generate |
| `H` (Notas) | `partidas.notas` |

#### Tab `Flujo de Pagos` → `estimaciones`

| Excel col | DB target |
|---|---|
| `C` (Fecha de pago) | `estimaciones.fecha_pago` if status="Pagado", else `fecha_solicitud` |
| `D` (Pagó) | `estimaciones.pagador_id` (FK lookup by name in `pagadores`) |
| `E` (Contratista) | used to look up `partidas.id` via contratista+partida |
| `F` (Partida) | used to look up `partidas.id` |
| `G` (Concepto) | `estimaciones.concepto` |
| `H` (# Estimación) | `estimaciones.numero` |
| `I` (Monto) | `estimaciones.monto_con_iva` (Excel stores con-IVA; derive `monto_sin_iva` from partida `iva_pct`) |
| `M` (Estatus) | `estimaciones.status`: "Pagado" → `'pagada'`, "No Pagado" → `'pendiente'` |
| `N` (Notas) | `estimaciones.notas` |

Excel columns `J` (Presupuesto), `K` (Pagado Acum.), `L` (Resto por Pagar) are computed in the Excel and **NOT migrated** — the app computes them from raw `monto_con_iva` aggregations.

Tabs `Resumen Total` and `Resumen Mensual` are pure views in Excel — nothing to migrate; the app computes them.

### Migration script — execution plan (Día 7+, after MVP is verified end-to-end with test data)

1. Alfonso exports each Google Sheet as `.xlsx` and places them in `scripts/migration/`:
   - `scripts/migration/nauka-lote-3.xlsx`
   - `scripts/migration/nauka-lote-44.xlsx`
   - `scripts/migration/nauka-beachfront.xlsx`
2. Script `scripts/migrate-from-excel.ts` (TypeScript, run via `pnpm tsx`):
   - Reads files with `exceljs` library.
   - Walks tabs in dependency order: `Configuración` → `Glosario` → `Presupuesto` → `Flujo de Pagos`.
   - Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
   - Idempotent: if a `projects.nombre` already exists, prompts to upsert or skip.
   - Prints summary: "X projects, Y contratistas, Z partidas, W estimaciones imported."
3. Run order: against `staging` Supabase project first → validate row counts + spot checks → then `prod`.
4. After successful prod migration, archive original Sheets in `/excel-archive/` (gitignored).

---

## 10. Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| DB / Auth / Storage | Supabase |
| PDF | @react-pdf/renderer |
| Email | Resend + React Email |
| Hosting | Vercel |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Charts | Recharts |
| Lint/format | Biome |
| Migrations | Supabase CLI |

---

## 11. Build Order (week 1)

| Day | Goal |
|---|---|
| 1 | Repo init, Supabase schema migration, RLS, Auth, login funciona. |
| 2 | `/` Consolidado + `/proyectos/[id]` con sub-nav de 6 tabs. Configuración tab funciona. |
| 3 | Presupuesto tab: CRUD de contratistas + partidas con upload de PDF. |
| 4 | Flujo de Pagos tab: tabla con filtros + CRUD de estimaciones. |
| 5 | Carátula tab: formulario + PDF + envío por Resend. |
| 6 | Estimación detail: carátula firmada, marcar pagada, comprobante. Resumen Mensual. |
| 7 | Resumen tab + Consolidado con números reales. Bugs de uso real. |
| Later | Migration script cuando Alfonso dé go. |

---

## 12. Skills / Plugins

```bash
# Grill-me (interview-style design)
mkdir -p .claude/skills/grill-me
curl -L https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md \
  -o .claude/skills/grill-me/SKILL.md

# OpenSpec (spec-driven changes) — buscar repo y descargar SKILL.md
```

---

## 13. Bootstrap Commands (run in order)

```bash
# 1. Init Next.js desde la raíz
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --use-pnpm

# 2. Core deps
pnpm add @supabase/supabase-js @supabase/ssr @react-pdf/renderer resend \
  react-hook-form zod @tanstack/react-table recharts react-email

# 3. shadcn/ui
pnpm dlx shadcn@latest init

# 4. Supabase
supabase init
supabase login
supabase link --project-ref <your_project_ref>
supabase migration new initial_schema
supabase db push

# 5. Vercel
vercel link

# 6. Dev
pnpm dev
```

---

## Appendix A — Decisiones tomadas en entrevista grill-me

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Firma carátula | Biblioteca de firmas escaneadas. No todos firman. |
| 2 | Captura presupuesto | Como Excel: contratista, partida, $ sin IVA, IVA %, total con IVA, notas + PDF. |
| 3 | Estados estimación | Binario: Pagado / Pendiente. |
| 4 | Proyectos | 3, mismo cliente NAUKA: Lote 3, Lote 44, Beachfront. |
| 5 | IVA en carátula | Per-project (con o sin IVA). |
| 6 | Destinatarios correo | Lista fija por proyecto: Alfonso + Jose + firmante elegido. |
| 7 | Migración | Migrar todo desde Google Sheets cuando Alfonso avise. |
| 8 | Auth | Email + password en Vercel. |

---

*End of SPEC.md v0.*
