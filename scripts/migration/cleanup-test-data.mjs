// scripts/migration/cleanup-test-data.mjs
// =====================================================================
// Limpieza one-shot de data de PRUEBA huérfana tras la migración de Lote 44.
// Spec: docs/changes/migration-lote-44.md (sección de limpieza) + investigación.
//
// DEFAULT = DRY-RUN. Escribe SOLO con --commit.
// DEFENSIVO: opera EXCLUSIVAMENTE sobre los IDs explícitos verificados abajo.
//   Aborta si alguna estimación objetivo NO está soft-deleted, o si aparece un
//   approval_request (ligado a esas estimaciones) fuera de la allow-list.
// ORDEN de ejecución: A1 (DELETE DB) → A3 (reset DB) → A2 (storage). Así, si el
//   DELETE falla por falta de GRANT/policy, aborta ANTES de tocar storage (sin
//   estado parcial). Idempotente: re-correr converge (los requests se derivan
//   de la DB, no se exige un conteo fijo).
// Requiere: migración 20260608210244 (GRANT + policy DELETE admin) aplicada con
//   `supabase db push`. Si no, el script aborta sin tocar storage.
//
// Uso:
//   node --env-file=.env.local scripts/migration/cleanup-test-data.mjs            # dry-run
//   node --env-file=.env.local scripts/migration/cleanup-test-data.mjs --commit   # ejecuta
// =====================================================================
import { createClient } from "@supabase/supabase-js"

const COMMIT = process.argv.includes("--commit")
const PROJECT = "f74c170c-da15-4ee5-a122-4e5dc6b281f3"

// --- IDs explícitos (de la investigación read-only) ---
const APPROVAL_REQUEST_IDS = [
  "8e68f134-1e96-4572-85b1-6b5a96156eb4", // R&R Imper #Est 1, ronda 1
  "3641e099-92c8-4818-8afa-fe41ab329cdb", // CYVSA/HVAC #Est 1, ronda 1
  "b4a1b0ec-a8fa-4aea-9b09-a775c4a73e0b", // CYVSA/HVAC #Est 1, ronda 2
]
const SOFT_DELETED_EST = {
  "986389a9-f72b-400d-9e40-a5641a65f528": "CYVSA/HVAC #Est 1",
  "a81c26c3-1c38-4086-995e-6b4fbb1a22ef": "CYVSA/HVAC #EST 2",
  "f7595a75-4871-4124-8479-ccc8eb65e10a": "R&R Imper #Est 1",
  "780fa11f-5cd0-42eb-9579-37ae38c145b9": "R&R Imper #EST 4",
}
const STORAGE_FILES = [
  `${PROJECT}/caratulas/780fa11f-5cd0-42eb-9579-37ae38c145b9_generada.pdf`,
  `${PROJECT}/caratulas/986389a9-f72b-400d-9e40-a5641a65f528_generada.pdf`,
  `${PROJECT}/caratulas/a81c26c3-1c38-4086-995e-6b4fbb1a22ef_1780330617728.pdf`,
  `${PROJECT}/caratulas/a81c26c3-1c38-4086-995e-6b4fbb1a22ef_generada.pdf`,
  `${PROJECT}/caratulas/f7595a75-4871-4124-8479-ccc8eb65e10a_generada.pdf`,
  `${PROJECT}/presupuestos/4e35a498-1f40-4241-afa1-6a61e25258ca.pdf`,
  `${PROJECT}/presupuestos/6151768d-81bb-47c3-904e-efb22b8a507e.pdf`,
]

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

const abort = (msg) => {
  console.error(`\n⛔ ABORTA (no se tocó nada destructivo): ${msg}`)
  process.exit(1)
}

// =================== VERIFICACIÓN DEFENSIVA (siempre) ===================
const estIds = Object.keys(SOFT_DELETED_EST)

// 1) Las 4 estimaciones objetivo DEBEN existir y estar soft-deleted (nunca tocar vivas).
const { data: ests, error: e1 } = await sb
  .from("estimaciones")
  .select(
    "id,deleted_at,caratula_generada_url,caratula_pdf_path,caratula_enviada_at",
  )
  .in("id", estIds)
if (e1) abort(`leyendo estimaciones: ${e1.message}`)
if (ests.length !== 4)
  abort(`esperaba 4 estimaciones objetivo, encontré ${ests.length}`)
for (const e of ests)
  if (!e.deleted_at)
    abort(`estimación ${e.id} NO está soft-deleted — es data viva`)

// 2) approval_requests ligados a esas 4 estimaciones = lo que se borrará (0-3, idempotente).
//    Tripwire: cada uno DEBE estar en la allow-list explícita y ser una carátula.
const { data: reqs, error: e2 } = await sb
  .from("approval_requests")
  .select("id,document_id,document_type,status")
  .in("document_id", estIds)
if (e2) abort(`leyendo approval_requests: ${e2.message}`)
for (const r of reqs) {
  if (r.document_type !== "caratula") abort(`request ${r.id} no es 'caratula'`)
  if (!APPROVAL_REQUEST_IDS.includes(r.id))
    abort(
      `request ${r.id} (ligado a estimación de prueba) NO está en la allow-list explícita`,
    )
}
const reqIds = reqs.map((r) => r.id)
let apprs = []
if (reqIds.length) {
  const { data, error: e3 } = await sb
    .from("approvals")
    .select("id")
    .in("request_id", reqIds)
  if (e3) abort(`leyendo approvals: ${e3.message}`)
  apprs = data ?? []
}

// =================== REPORTE DEL PLAN ===================
console.log(
  `\n===== CLEANUP TEST DATA — ${COMMIT ? "COMMIT (ESCRIBIENDO)" : "DRY-RUN (sin escribir)"} =====`,
)
console.log(
  "✓ Defensiva OK: 4 estimaciones objetivo soft-deleted; requests ligados ⊆ allow-list.\n",
)
console.log(
  `A1 — DELETE approval_requests: ${reqs.length}  (cascade ${apprs.length} approvals)`,
)
for (const r of reqs)
  console.log(`     ${r.id}  ${SOFT_DELETED_EST[r.document_id]}  [${r.status}]`)
console.log(`\nA2 — DELETE storage objects: ${STORAGE_FILES.length}`)
for (const f of STORAGE_FILES) console.log(`     ${f}`)
console.log(
  `\nA3 — RESET (generada_url, pdf_path, enviada_at) en estimaciones soft-deleted: ${ests.length}`,
)
for (const e of ests) {
  const refs = [
    e.caratula_generada_url && "generada_url",
    e.caratula_pdf_path && "pdf_path",
    e.caratula_enviada_at && "enviada_at",
  ].filter(Boolean)
  console.log(
    `     ${SOFT_DELETED_EST[e.id]}: ${refs.join(", ") || "(sin refs)"}`,
  )
}

if (!COMMIT) {
  console.log("\n→ DRY-RUN. Nada se escribió. Para ejecutar: agrega --commit")
  process.exit(0)
}

// =================== EJECUCIÓN: A1 (DB) → A3 (DB) → A2 (storage) ===================
console.log("\n--- ejecutando ---")

// A1: borra los requests por id (cascade borra los approvals). Verifica después.
if (reqIds.length) {
  const { error: delErr } = await sb
    .from("approval_requests")
    .delete()
    .in("id", reqIds)
  if (delErr)
    abort(
      `DELETE approval_requests: ${delErr.message} — ¿falta GRANT/policy DELETE (migración 20260608210244)?`,
    )
  const { data: reqsAfter } = await sb
    .from("approval_requests")
    .select("id")
    .in("id", reqIds)
  const { data: apprsAfter } = await sb
    .from("approvals")
    .select("id")
    .in("request_id", reqIds)
  if (reqsAfter.length || apprsAfter.length) {
    abort(
      `DELETE no eliminó todo (requests=${reqsAfter.length}, approvals=${apprsAfter.length}) — GRANT/policy DELETE no aplicada (RLS no-op silencioso)`,
    )
  }
  console.log(
    `A1: ${reqIds.length} approval_requests + ${apprs.length} approvals eliminados`,
  )
} else {
  console.log("A1: nada que borrar (ya limpio)")
}

// A3: reset de refs (solo sobre las 4 soft-deleted ya verificadas).
const { error: updErr } = await sb
  .from("estimaciones")
  .update({
    caratula_generada_url: null,
    caratula_pdf_path: null,
    caratula_enviada_at: null,
  })
  .in("id", estIds)
if (updErr) abort(`reset estimaciones: ${updErr.message}`)
console.log(
  `A3: refs de carátula reseteadas en ${ests.length} estimaciones soft-deleted`,
)

// A2: storage al final (idempotente; si un archivo no existe, no es error).
const { data: removed, error: rmErr } = await sb.storage
  .from("proyectos")
  .remove(STORAGE_FILES)
if (rmErr) abort(`storage.remove: ${rmErr.message}`)
console.log(`A2: ${removed.length} storage objects eliminados`)

console.log("\n✅ Limpieza aplicada.")
