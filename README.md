# NAUKA Pagos

Internal web app for **IZ Arquitectos** to manage budgets, payment estimaciones (carátulas), and proof of payment across the three NAUKA projects: **Lote 3**, **Lote 44**, and **Beachfront**.

Replaces three parallel Excel/Google Sheets files with a single source of truth.

---

## Stack

Next.js 15 · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres + Auth + Storage) · Resend · Vercel.

---

## Folder structure

```
.
├── CLAUDE.md                       Instructions for Claude Code (the AI agent)
├── README.md                        This file
├── docs/
│   └── SPEC.md                     Product spec: data model, workflows, build order
└── reference/
    └── NAUKA_Flujo_Pagos.xlsx       The Excel this app replaces (reference only)
```

Once bootstrapped, the project root will also contain `src/`, `public/`, `supabase/`, `package.json`, `.env.local`, etc.

---

## Getting started

1. Open this folder in Claude Code (Claude desktop app → switch to Claude Code mode → select this folder).
2. Claude Code automatically reads `CLAUDE.md` and follows the instructions there.
3. First prompt: *"Lee CLAUDE.md y docs/SPEC.md. Confírmame en un párrafo que entendiste qué construimos y bajo qué reglas. No escribas código todavía."*
4. Once the summary checks out, follow the Build Order in `docs/SPEC.md` section 11.

---

## Users

- **Alfonso** — admin
- **Jessica** — admin

Auth via Supabase email + password.

---

*Day 0 — pre-bootstrap. Stack not installed yet.*
