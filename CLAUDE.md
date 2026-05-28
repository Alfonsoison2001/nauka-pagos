# CLAUDE.md — Project Instructions for Claude Code

This file tells you (Claude Code) how to work in this project. Read it FIRST in every session.

---

## Project

**NAUKA Pagos** — Internal web app for IZ Arquitectos.
Replaces 3 parallel Excel files used by Alfonso + Jessica to manage budgets, payment estimaciones (carátulas), and proof of payment across 3 NAUKA real estate projects (Lote 3, Lote 44, Beachfront).

---

## Source of truth (read in this order)

1. **`docs/SPEC.md`** — Full product spec: data model, workflows, build order, stack. ALWAYS reference this when implementing a feature. If something contradicts the spec, stop and ask.
2. **`reference/NAUKA_Flujo_Pagos.xlsx`** — The original Excel this app replaces. Use it to validate that the app reflects the same columns, labels, and logic the users are used to.
3. **`docs/design-prompt.md`** (added later) — Visual design system. Until this file exists, do NOT spend effort polishing UI; use sensible defaults from shadcn/ui.

---

## Stack (non-negotiable)

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **DB / Auth / Storage:** Supabase
- **PDF:** `@react-pdf/renderer`
- **Email:** Resend + React Email templates
- **Hosting:** Vercel
- **Forms:** React Hook Form + Zod
- **Tables:** TanStack Table
- **Charts:** Recharts
- **Lint/format:** Biome
- **Migrations:** Supabase CLI (`supabase migration new ...`)
- **Package manager:** **pnpm** (never npm or yarn).

---

## Conventions

### Code style

- TypeScript strict mode. No `any` unless absolutely necessary, and document why.
- Server Components by default. Use `"use client"` only when there's interaction (forms, dropdowns, etc.).
- Server Actions for mutations. No REST API routes unless strictly needed.
- All Supabase queries through the SSR helper (`@supabase/ssr`), never the browser client for protected data.
- File naming: `kebab-case` for files, `PascalCase` for components, `camelCase` for variables.
- Functions and components have at most 80 lines. If longer, split.

### Database

- All tables have `id uuid primary key default gen_random_uuid()` and `created_at timestamptz default now()`.
- Audit log via Postgres triggers (see SPEC.md section 3).
- Foreign keys always. No orphan rows.
- All money in `numeric(14,2)`. No floats.
- All dates in `date` (without time) unless time matters (`fecha_pago`, `created_at`).

### Forms

- Always validate with Zod schemas on both client and server.
- Use `react-hook-form` with `@hookform/resolvers/zod`.
- Errors inline below the field, no toasts for validation.

### File uploads

- Always go through Supabase Storage with deterministic paths (see SPEC.md section 3 → Storage buckets).
- Max file size: 10MB per file. Validate client + server.
- Accept only PDFs for `presupuesto_pdf` and `caratula_firmada`. Accept PDF or image for `comprobante_pago`.

### Money formatting

- Display: `$ 1,234,567.89` (with space after `$`, comma thousands).
- Always `font-variant-numeric: tabular-nums` in tables.
- Locale: `es-MX`. Currency: `MXN`. Numbers via `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`.

### Dates

- Display: `dd/mm/yyyy` (e.g., `08/05/2026`).
- Storage: ISO `yyyy-mm-dd`.
- Use `date-fns` with `es` locale.

---

## Mirror the Excel literally

The users live in Excel today. Their mental model is **one project = one file = 6 tabs**.

The app MUST replicate:

### Top-level nav

- NAUKA logo (links to `/`)
- Project selector dropdown
- "Consolidado" link (cross-project read-only view — the only thing not in Excel)
- User avatar

### Per-project sub-nav (these 6 tabs in exact order with exact labels)

1. **Resumen** ↔ Excel "Resumen Total"
2. **Presupuesto** ↔ Excel "Presupuesto"
3. **Flujo de Pagos** ↔ Excel "Flujo de Pagos"
4. **Carátula** ↔ Excel "Carátula"
5. **Resumen Mensual** ↔ Excel "Resumen Mensual"
6. **Configuración** ↔ Excel "Configuración" + "Glosario"

### Column names in tables must match the Excel exactly

For `Flujo de Pagos` table for example:
`#`, `EOM`, `Fecha de pago`, `Pagó`, `Contratista`, `Partida`, `# Estimación`, `Monto`, `Presupuesto`, `Pagado Acum.`, `Resto por Pagar`, `Estatus`, `Notas`.

DO NOT invent new column names. DO NOT translate "Presupuesto" to "Budget".

---

## Workflow (use these skills)

Two skills should live in `.claude/skills/`:

- **`grill-me`** — Use BEFORE building any non-trivial feature. Interview the user about edge cases, defaults, and ambiguity until there is shared understanding. Ask one question at a time with your recommendation.
- **`openspec`** — Use AFTER grill-me. Generate a change proposal as `change.md`. User reviews it. Only THEN implement.

The loop for every new feature:

1. User asks for feature X.
2. Run `grill-me` → resolve all open questions.
3. Run `openspec` → generate `change.md`.
4. User approves the change.
5. Implement following the change.
6. Run `pnpm build` and `pnpm test` (when tests exist). Fix errors.
7. Commit with message: `feat(scope): description` or `fix(scope): description`.
8. Push to remote. Vercel preview deploys.
9. User tests in preview. If OK, merge to main.

---

## Regression prevention (CRITICAL — applies to every change)

This is the single most important rule. When the user asks for a change, follow these:

1. **Surgical edits only.** Touch the minimum number of files and lines needed. Do NOT refactor unrelated code "while you're there".
2. **Read before writing.** Before editing a component, read its full current state. Understand what it does today before changing it.
3. **Preserve existing behavior.** If a feature worked before (edit button visible, table sort, dropdown filter), it MUST keep working after the change.
4. **Verify affected surfaces.** After making changes, mentally walk through the user paths that touch the modified files. Test the obvious ones in dev before declaring done.
5. **Never delete code you don't fully understand.** If you see code that seems redundant or out of place, leave it. If you want to remove it, ask the user first.
6. **Per-change validation:** before sending changes to the user for verification, list out what features should still work end-to-end. Mentally check each one.
7. **No "cleanup" passes.** Do not "improve" formatting, naming, structure, or organization of code that isn't directly involved in the requested change.

If a regression is reported, the fix is: read the diff of recent changes, find what got removed/broken, restore it with minimal touch.

## What NOT to do

- ❌ Do not write code BEFORE running `grill-me` and `openspec` on a feature.
- ❌ Do not use `any` in TypeScript.
- ❌ Do not use `console.log` in production code. Use `console.error` for actual errors only.
- ❌ Do not commit secrets. `.env.local` is gitignored.
- ❌ Do not modify the Supabase schema directly via SQL editor — always go through `supabase migration new`.
- ❌ Do not delete data with `DELETE`. Always soft-delete via `deleted_at`.
- ❌ Do not rename columns/labels that exist in the Excel. If you think a name should change, ask first.
- ❌ Do not polish UI before functionality is correct. Function first, then style (when `design-prompt.md` lands).
- ❌ Do not introduce new dependencies without asking. The stack is fixed.
- ❌ Do not create CI/CD pipelines, Storybook, e2e tests, or "developer experience" tooling unless explicitly asked.

---

## When you're confused

- If `SPEC.md` doesn't cover something, ASK the user. Do not invent.
- If something contradicts the Excel mental model, ASK before changing.
- If you finish a feature, run `pnpm build` to verify no TS errors before declaring done.
- If a Supabase RLS policy blocks something, stop and ask before disabling it.

---

## Environment

Local dev:
```bash
pnpm dev          # http://localhost:3000
pnpm build        # production build to verify before push
supabase start    # local Supabase if needed
```

Environment variables in `.env.local` (gitignored). Same vars in Vercel dashboard for prod.

---

## Folder structure (Day 0)

```
Nauka - Pagos/
├── CLAUDE.md                       ← this file (your operating manual)
├── README.md                        ← brief project intro
├── docs/
│   └── SPEC.md                     ← the product spec
└── reference/
    └── NAUKA_Flujo_Pagos.xlsx       ← the Excel being replaced
```

After bootstrap (Day 1), Next.js will populate `src/`, `public/`, `supabase/`, `package.json`, etc. at the root. The `docs/` and `reference/` folders stay untouched.

## Today's status

This is **Day 0**. Next step is **Day 1** of `docs/SPEC.md` section 11 build order: repo init, schema migration, RLS, Auth, login working.

---

*This file is the contract between you and the user. When in doubt, re-read it.*
