// Backup de las tablas operativas (public schema).
// Camino preferido: sesión autenticada como admin (el rol `authenticated` tiene
// los grants de tabla + RLS USING(true), así que lee TODO, incl. soft-deleted).
// Fallback: service_role (puede fallar con "permission denied" si no tiene grants).
//
// Uso: node --env-file=.env.local scripts/backup-tables.mjs <outDir>
// Envs: NEXT_PUBLIC_SUPABASE_URL (req), y para admin:
//   BACKUP_ADMIN_EMAIL + BACKUP_ADMIN_PASSWORD + NEXT_PUBLIC_SUPABASE_ANON_KEY
// Escribe <table>.json + <table>.csv + _manifest.json en <outDir>.

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const adminEmail = process.env.BACKUP_ADMIN_EMAIL
const adminPassword = process.env.BACKUP_ADMIN_PASSWORD
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL")
  process.exit(1)
}

// Tablas operativas en orden de dependencia (mismo orden que usaríamos para restaurar).
const TABLES = [
  "projects",
  "firmantes",
  "project_firmantes",
  "pagadores",
  "contratistas",
  "partidas",
  "estimaciones",
  "profiles",
  "approval_requests",
  "approvals",
  "audit_log",
]

const outDir = process.argv[2] || "backups/_staging"
mkdirSync(outDir, { recursive: true })

let sb
let authMode
if (adminEmail && adminPassword) {
  if (!anon) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY para el login admin")
    process.exit(1)
  }
  sb = createClient(url, anon, { auth: { persistSession: false } })
  const { error } = await sb.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error) {
    console.error("Login admin falló:", error.message)
    process.exit(1)
  }
  authMode = `admin (${adminEmail.replace(/(.).+(@.+)/, "$1***$2")})`
} else if (serviceKey) {
  sb = createClient(url, serviceKey, { auth: { persistSession: false } })
  authMode = "service_role (fallback)"
} else {
  console.error(
    "Sin credenciales: define BACKUP_ADMIN_EMAIL+BACKUP_ADMIN_PASSWORD o SUPABASE_SERVICE_ROLE_KEY",
  )
  process.exit(1)
}
console.log(`Auth: ${authMode}`)

function toCsv(rows) {
  if (!rows.length) return ""
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const esc = (v) => {
    if (v === null || v === undefined) return ""
    const s = typeof v === "object" ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = cols.join(",")
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n")
  return `${head}\n${body}\n`
}

// Paginación basada en COUNT exacto: avanza por el nº de filas realmente devueltas
// (robusto ante cualquier cap de max-rows de PostgREST). Marca `expected` si no cuadra.
async function dumpTable(t) {
  const { count, error: cErr } = await sb
    .from(t)
    .select("*", { count: "exact", head: true })
  if (cErr) return { table: t, rows: "ERROR", error: cErr.message }
  const total = count ?? 0
  const all = []
  let from = 0
  while (all.length < total) {
    const { data, error } = await sb
      .from(t)
      .select("*")
      .range(from, from + 999)
    if (error) return { table: t, rows: "ERROR", error: error.message }
    if (!data.length) break // sin progreso: evita loop infinito
    all.push(...data)
    from += data.length
  }
  writeFileSync(join(outDir, `${t}.json`), JSON.stringify(all, null, 2))
  writeFileSync(join(outDir, `${t}.csv`), toCsv(all))
  const r = { table: t, rows: all.length }
  if (all.length !== total) r.expected = total
  return r
}

const summary = []
let hadError = false
for (const t of TABLES) {
  const r = await dumpTable(t)
  if (r.rows === "ERROR" || r.expected != null) hadError = true
  summary.push(r)
}

writeFileSync(
  join(outDir, "_manifest.json"),
  JSON.stringify(
    {
      purpose: "pre-migration backup",
      auth_mode: authMode,
      generated_at: new Date().toISOString(),
      out_dir: outDir,
      tables: summary,
    },
    null,
    2,
  ),
)

console.log("TABLA".padEnd(22), "FILAS")
for (const r of summary) {
  const flag = r.expected != null ? ` (¡esperado ${r.expected}!)` : ""
  const err = r.error ? ` (${r.error})` : ""
  console.log(String(r.table).padEnd(22), r.rows, `${flag}${err}`)
}
if (hadError) {
  console.error("\nHubo errores o conteos que no cuadran — revisa arriba.")
  process.exit(2)
}
