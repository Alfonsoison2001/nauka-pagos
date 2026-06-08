// scripts/migration/validate-lote-44.mjs
// Validación SOLO-LECTURA del resultado de la migración (lee directo de DB).
// Uso: node --env-file=.env.local scripts/migration/validate-lote-44.mjs
import { createClient } from "@supabase/supabase-js"

const LOTE = "NAUKA Lote 44"
const EXPECTED_EJERCIDO = 647748.01

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.BACKUP_ADMIN_EMAIL
const pass = process.env.BACKUP_ADMIN_PASSWORD
if (!url || !anon || !email || !pass) {
  console.error("Faltan envs (URL/ANON/BACKUP_ADMIN_EMAIL/PASSWORD)")
  process.exit(1)
}

const sb = createClient(url, anon, { auth: { persistSession: false } })
const { error: authErr } = await sb.auth.signInWithPassword({
  email,
  password: pass,
})
if (authErr) {
  console.error("Login admin falló:", authErr.message)
  process.exit(1)
}

const { data: proj } = await sb
  .from("projects")
  .select("id")
  .eq("nombre", LOTE)
  .is("deleted_at", null)
  .maybeSingle()
const pid = proj.id

// --- conteos activos ---
const { data: contr } = await sb
  .from("contratistas")
  .select("id,nombre")
  .eq("project_id", pid)
  .is("deleted_at", null)
const cids = contr.map((c) => c.id)
const { data: part } = await sb
  .from("partidas")
  .select("id")
  .in("contratista_id", cids)
  .is("deleted_at", null)
const pids = part.map((p) => p.id)
const { data: est } = await sb
  .from("estimaciones")
  .select("monto_con_iva,status")
  .in("partida_id", pids)
  .is("deleted_at", null)
const ejercido =
  Math.round(
    est
      .filter((e) => e.status === "pagada")
      .reduce((s, e) => s + Number(e.monto_con_iva), 0) * 100,
  ) / 100

// --- data de prueba: debe estar soft-deleted (scoped a L44) ---
const { data: test } = await sb
  .from("contratistas")
  .select("nombre,deleted_at")
  .eq("project_id", pid)
  .in("nombre", ["CYVSA", "R&R Imper"])

const ok = (c) => (c ? "✓" : "✗")
console.log(`\n===== VALIDACIÓN — ${LOTE} (lectura directa de DB) =====\n`)
console.log("CONTEOS ACTIVOS")
console.log(
  `  contratistas: ${contr.length}  ${ok(contr.length === 6)} (esperado 6)`,
)
console.log(
  `  partidas:     ${part.length}  ${ok(part.length === 6)} (esperado 6)`,
)
console.log(
  `  estimaciones: ${est.length}  ${ok(est.length === 7)} (esperado 7)`,
)
console.log(
  `  ejercido (Σ monto_con_iva pagadas): ${ejercido.toFixed(2)}  ${ok(Math.abs(ejercido - EXPECTED_EJERCIDO) < 0.005)} (esperado ${EXPECTED_EJERCIDO})`,
)
console.log("\nSOFT-DELETE de data de prueba")
for (const t of test) {
  console.log(
    `  ${t.nombre}: deleted_at=${t.deleted_at ?? "NULL"}  ${ok(!!t.deleted_at)} ${t.deleted_at ? "soft-deleted" : "AÚN ACTIVO"}`,
  )
}
console.log(
  `\n  contratistas activos: ${contr.map((c) => c.nombre).join(", ")}`,
)
