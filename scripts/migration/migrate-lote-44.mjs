// scripts/migration/migrate-lote-44.mjs
// =====================================================================
// Migración de datos reales — NAUKA Lote 44 (tabs Presupuesto + Flujo de Pagos)
// Especificación: docs/changes/migration-lote-44.md
//
// DEFAULT = DRY-RUN (no escribe nada). Escribe SOLO con --commit.
// Auth = sesión admin (BACKUP_ADMIN_EMAIL/PASSWORD en .env.local), NO service_role.
//
// Uso:
//   node --env-file=.env.local scripts/migration/migrate-lote-44.mjs            # dry-run
//   node --env-file=.env.local scripts/migration/migrate-lote-44.mjs --commit   # escribe
// =====================================================================
import { createClient } from "@supabase/supabase-js"
import ExcelJS from "exceljs"

const COMMIT = process.argv.includes("--commit")

const CONFIG = {
  loteNombre: "NAUKA Lote 44",
  xlsxPath: "scripts/migration/lote-44.xlsx",
  presupuestoSheet: "Presupuesto",
  flujoSheet: "Flujo de Pagos",
  expected: { contratistas: 6, partidas: 6, estimaciones: 7 },
  expectedEjercido: 647748.01,
}

const SEP = "\u001f"
const norm = (v) => (v == null ? "" : String(v).trim())
const lc = (v) => norm(v).toLowerCase()
const money = (v) => Math.round(Number(v) * 100) / 100

function cellVal(cell) {
  let v = cell?.value
  if (v && typeof v === "object") {
    if (v instanceof Date) return v
    if ("result" in v)
      v = v.result // celda con fórmula → valor cacheado
    else if ("text" in v)
      v = v.text // hyperlink
    else if (Array.isArray(v.richText))
      v = v.richText.map((t) => t.text).join("")
  }
  return v
}

function toISODate(v) {
  if (v == null || v === "") return null
  if (v instanceof Date) {
    const y = v.getUTCFullYear()
    const m = String(v.getUTCMonth() + 1).padStart(2, "0")
    const d = String(v.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  return null
}

// ---- leer Excel: filas reales (ignora plantillas con fórmulas vacías) ----
async function readExcel() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(CONFIG.xlsxPath)
  const ps = wb.getWorksheet(CONFIG.presupuestoSheet)
  const fl = wb.getWorksheet(CONFIG.flujoSheet)
  if (!ps || !fl)
    throw new Error("No encuentro las tabs Presupuesto / Flujo de Pagos")

  const partidas = []
  for (let r = 7; r <= ps.rowCount; r++) {
    const contratista = norm(cellVal(ps.getCell(r, 2))) // B
    const nombre = norm(cellVal(ps.getCell(r, 3))) // C
    const sin = cellVal(ps.getCell(r, 4)) // D
    if (
      !contratista ||
      !nombre ||
      sin == null ||
      sin === "" ||
      Number(sin) === 0
    )
      continue
    const ivaRaw = cellVal(ps.getCell(r, 5)) // E
    partidas.push({
      contratista,
      nombre,
      presupuesto_sin_iva: money(sin),
      iva_pct: ivaRaw == null || ivaRaw === "" ? 0.16 : Number(ivaRaw),
      notas: norm(cellVal(ps.getCell(r, 8))) || null, // H
      row: r,
    })
  }

  const estimaciones = []
  for (let r = 7; r <= fl.rowCount; r++) {
    const contratista = norm(cellVal(fl.getCell(r, 5))) // E
    const partida = norm(cellVal(fl.getCell(r, 6))) // F
    const monto = cellVal(fl.getCell(r, 9)) // I
    if (
      !contratista ||
      !partida ||
      monto == null ||
      monto === "" ||
      Number(monto) === 0
    )
      continue
    const fpago = toISODate(cellVal(fl.getCell(r, 3))) // C
    const eom = toISODate(cellVal(fl.getCell(r, 2))) // B (fallback)
    const estatus = norm(cellVal(fl.getCell(r, 13))) // M
    estimaciones.push({
      contratista,
      partida,
      numero: norm(cellVal(fl.getCell(r, 8))), // H
      monto: money(monto),
      pagador: norm(cellVal(fl.getCell(r, 4))), // D
      fecha_estimacion: fpago || eom,
      status: lc(estatus) === "pagado" ? "pagada" : "pendiente",
      row: r,
    })
  }
  return { partidas, estimaciones }
}

// ---- estado actual en DB (acotado a Lote 44) --------------------------
async function fetchDb(sb, projectId) {
  const { data: contr } = await sb
    .from("contratistas")
    .select("id,nombre")
    .eq("project_id", projectId)
    .is("deleted_at", null)
  const ids = (contr ?? []).map((c) => c.id)
  let partidas = []
  if (ids.length) {
    const { data } = await sb
      .from("partidas")
      .select("id,contratista_id,nombre,presupuesto_sin_iva,iva_pct,notas")
      .in("contratista_id", ids)
      .is("deleted_at", null)
    partidas = data ?? []
  }
  const pids = partidas.map((p) => p.id)
  let estimaciones = []
  if (pids.length) {
    const { data } = await sb
      .from("estimaciones")
      .select(
        "id,partida_id,numero,monto_sin_iva,iva_pct,pagador_id,fecha_estimacion,status",
      )
      .in("partida_id", pids)
      .is("deleted_at", null)
    estimaciones = data ?? []
  }
  const { data: pagadores } = await sb
    .from("pagadores")
    .select("id,nombre,project_id")
    .is("deleted_at", null)
  return {
    contr: contr ?? [],
    partidas,
    estimaciones,
    pagadores: pagadores ?? [],
  }
}

// ---- sync contratistas → Map nombre→id --------------------------------
async function syncContratistas(sb, projectId, desired, db, rep) {
  const byName = new Map(db.contr.map((c) => [c.nombre, c.id]))
  for (const nombre of desired) {
    if (byName.has(nombre)) continue // existe (clave = nombre; nada que actualizar)
    if (COMMIT) {
      const { data, error } = await sb
        .from("contratistas")
        .insert({ project_id: projectId, nombre })
        .select("id")
        .single()
      if (error) {
        rep.warnings.push(`INSERT contratista ${nombre}: ${error.message}`)
        continue
      }
      byName.set(nombre, data.id)
    } else {
      byName.set(nombre, "(new)")
    }
    rep.inserts.push(`contratista: ${nombre}`)
  }
  return byName
}

// ---- sync partidas → Map (contr|partida)→id ---------------------------
async function syncPartidas(sb, xl, contrByName, db, rep) {
  const dbByKey = new Map(
    db.partidas.map((p) => [`${p.contratista_id}${SEP}${p.nombre}`, p]),
  )
  const byContrPart = new Map()
  for (const p of xl.partidas) {
    const cId = contrByName.get(p.contratista)
    const ck = `${p.contratista}${SEP}${p.nombre}`
    const existing =
      cId && cId !== "(new)" ? dbByKey.get(`${cId}${SEP}${p.nombre}`) : null
    if (existing) {
      const changed =
        money(existing.presupuesto_sin_iva) !== p.presupuesto_sin_iva ||
        Number(existing.iva_pct) !== p.iva_pct ||
        (existing.notas ?? null) !== (p.notas ?? null)
      if (changed) {
        if (COMMIT) {
          const { error } = await sb
            .from("partidas")
            .update({
              presupuesto_sin_iva: p.presupuesto_sin_iva,
              iva_pct: p.iva_pct,
              notas: p.notas,
            })
            .eq("id", existing.id)
          if (error)
            rep.warnings.push(`UPDATE partida ${p.nombre}: ${error.message}`)
        }
        rep.updates.push(`partida: ${p.contratista} / ${p.nombre}`)
      }
      byContrPart.set(ck, existing.id)
    } else {
      if (COMMIT && cId && cId !== "(new)") {
        const { data, error } = await sb
          .from("partidas")
          .insert({
            contratista_id: cId,
            nombre: p.nombre,
            presupuesto_sin_iva: p.presupuesto_sin_iva,
            iva_pct: p.iva_pct,
            notas: p.notas,
          })
          .select("id")
          .single()
        if (error) {
          rep.warnings.push(`INSERT partida ${p.nombre}: ${error.message}`)
          continue
        }
        byContrPart.set(ck, data.id)
      } else {
        byContrPart.set(ck, "(new)")
      }
      rep.inserts.push(
        `partida: ${p.contratista} / ${p.nombre}  sinIVA=${p.presupuesto_sin_iva} iva=${p.iva_pct}`,
      )
    }
  }
  return byContrPart
}

// ---- sync estimaciones → ejercido (Σ con-IVA pagadas) -----------------
async function syncEstimaciones(sb, xl, partByContrPart, db, rep) {
  const pagByName = new Map()
  for (const pg of db.pagadores) {
    const k = lc(pg.nombre)
    if (!pagByName.has(k) || pg.project_id == null) pagByName.set(k, pg.id) // prefiere global
  }
  const dbByKey = new Map(
    db.estimaciones.map((e) => [`${e.partida_id}${SEP}${e.numero}`, e]),
  )
  let ejercido = 0
  for (const e of xl.estimaciones) {
    const pId = partByContrPart.get(`${e.contratista}${SEP}${e.partida}`)
    if (pId == null) {
      rep.warnings.push(
        `estimación r${e.row} ${e.contratista}/${e.partida} #${e.numero}: partida no resuelta — SE SALTA`,
      )
      continue
    }
    if (!e.fecha_estimacion)
      rep.warnings.push(`estimación r${e.row} #${e.numero}: fecha no parseable`)
    const pagId = pagByName.get(lc(e.pagador)) ?? null
    if (!pagId)
      rep.warnings.push(
        `estimación r${e.row}: pagador "${e.pagador}" sin match → null`,
      )
    if (e.status === "pagada") ejercido = money(ejercido + e.monto)

    const fields = {
      monto_sin_iva: e.monto,
      iva_pct: 0,
      pagador_id: pagId,
      fecha_estimacion: e.fecha_estimacion,
      status: e.status,
    }
    const existing =
      pId !== "(new)" ? dbByKey.get(`${pId}${SEP}${e.numero}`) : null
    if (existing) {
      const changed =
        money(existing.monto_sin_iva) !== e.monto ||
        Number(existing.iva_pct) !== 0 ||
        (existing.pagador_id ?? null) !== pagId ||
        (existing.fecha_estimacion ?? null) !== e.fecha_estimacion ||
        existing.status !== e.status
      if (changed) {
        if (COMMIT) {
          const { error } = await sb
            .from("estimaciones")
            .update(fields)
            .eq("id", existing.id)
          if (error)
            rep.warnings.push(`UPDATE estimación ${e.numero}: ${error.message}`)
        }
        rep.updates.push(
          `estimación: ${e.contratista}/${e.partida} #${e.numero}`,
        )
      }
    } else {
      if (COMMIT && pId !== "(new)") {
        const { error } = await sb.from("estimaciones").insert({
          partida_id: pId,
          numero: e.numero,
          concepto: null,
          notas: null,
          ...fields,
        })
        if (error) {
          rep.warnings.push(`INSERT estimación ${e.numero}: ${error.message}`)
          continue
        }
      }
      rep.inserts.push(
        `estimación: ${e.contratista}/${e.partida} #${e.numero}  $${e.monto}  ${e.fecha_estimacion}  ${e.status}`,
      )
    }
  }
  return ejercido
}

// ---- soft-delete de filas activas de L44 ausentes del Excel -----------
async function softDeleteAbsent(sb, xl, desiredContr, db, rep, nowISO) {
  const wantContr = new Set(desiredContr)
  const wantPart = new Set(
    xl.partidas.map((p) => `${p.contratista}${SEP}${p.nombre}`),
  )
  const wantEst = new Set(
    xl.estimaciones.map(
      (e) => `${e.contratista}${SEP}${e.partida}${SEP}${e.numero}`,
    ),
  )
  const contrName = new Map(db.contr.map((c) => [c.id, c.nombre]))
  const partName = new Map(db.partidas.map((p) => [p.id, p.nombre]))
  const partContr = new Map(db.partidas.map((p) => [p.id, p.contratista_id]))
  const del = async (table, id) => {
    if (COMMIT) await sb.from(table).update({ deleted_at: nowISO }).eq("id", id)
  }

  for (const e of db.estimaciones) {
    const cName = contrName.get(partContr.get(e.partida_id))
    const pName = partName.get(e.partida_id)
    if (!wantEst.has(`${cName}${SEP}${pName}${SEP}${e.numero}`)) {
      await del("estimaciones", e.id)
      rep.softDeletes.push(
        `estimación: ${cName}/${pName} #${e.numero} (${e.id})`,
      )
    }
  }
  for (const p of db.partidas) {
    const cName = contrName.get(p.contratista_id)
    if (!wantPart.has(`${cName}${SEP}${p.nombre}`)) {
      await del("partidas", p.id)
      rep.softDeletes.push(`partida: ${cName}/${p.nombre} (${p.id})`)
    }
  }
  for (const c of db.contr) {
    if (!wantContr.has(c.nombre)) {
      await del("contratistas", c.id)
      rep.softDeletes.push(`contratista: ${c.nombre} (${c.id})`)
    }
  }
}

function printReport(rep, parsed, ejercido) {
  const mode = COMMIT ? "COMMIT (ESCRIBIENDO)" : "DRY-RUN (sin escribir)"
  console.log(`\n===== MIGRACIÓN LOTE 44 — ${mode} =====\n`)
  const sec = (t, a) => {
    console.log(`--- ${t} (${a.length}) ---`)
    console.log(a.length ? a.map((x) => `  ${x}`).join("\n") : "  (ninguno)")
    console.log("")
  }
  sec("INSERTS", rep.inserts)
  sec("UPDATES", rep.updates)
  sec("SOFT-DELETES", rep.softDeletes)
  sec("WARNINGS", rep.warnings)

  const exp = CONFIG.expected
  const okCounts =
    parsed.c === exp.contratistas &&
    parsed.p === exp.partidas &&
    parsed.e === exp.estimaciones
  const okEj = Math.abs(ejercido - CONFIG.expectedEjercido) < 0.005
  console.log("===== RESUMEN =====")
  console.log(
    `  parseado del Excel: ${parsed.c} contratistas, ${parsed.p} partidas, ${parsed.e} estimaciones  ${okCounts ? "✓" : "✗ (esperado 6/6/7)"}`,
  )
  console.log(
    `  inserts=${rep.inserts.length}  updates=${rep.updates.length}  soft-deletes=${rep.softDeletes.length}  warnings=${rep.warnings.length}`,
  )
  console.log(
    `  ejercido (Σ estimaciones pagadas): ${ejercido.toFixed(2)}  ${okEj ? "✓ = Excel (647,748.01)" : "✗ (esperado 647,748.01)"}`,
  )
  console.log(
    COMMIT
      ? "\n  ✅ Cambios aplicados."
      : "\n  → DRY-RUN. Para escribir: agrega --commit",
  )
}

async function migrate() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.BACKUP_ADMIN_EMAIL
  const pass = process.env.BACKUP_ADMIN_PASSWORD
  if (!url || !anon || !email || !pass) {
    console.error(
      "Faltan envs: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + BACKUP_ADMIN_EMAIL/PASSWORD",
    )
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
    .select("id,nombre")
    .eq("nombre", CONFIG.loteNombre)
    .is("deleted_at", null)
    .maybeSingle()
  if (!proj) {
    console.error(`No encuentro el proyecto "${CONFIG.loteNombre}"`)
    process.exit(1)
  }

  console.log(
    `Excel: ${CONFIG.xlsxPath} | proyecto: ${proj.nombre} (${proj.id}) | auth: admin (${email.replace(/(.).+(@.+)/, "$1***$2")})`,
  )

  const xl = await readExcel()
  const db = await fetchDb(sb, proj.id)
  const rep = { inserts: [], updates: [], softDeletes: [], warnings: [] }
  const nowISO = new Date().toISOString()

  const desiredContr = [...new Set(xl.partidas.map((p) => p.contratista))]
  const contrByName = await syncContratistas(sb, proj.id, desiredContr, db, rep)
  const partByContrPart = await syncPartidas(sb, xl, contrByName, db, rep)
  const ejercido = await syncEstimaciones(sb, xl, partByContrPart, db, rep)
  await softDeleteAbsent(sb, xl, desiredContr, db, rep, nowISO)

  printReport(
    rep,
    {
      c: desiredContr.length,
      p: xl.partidas.length,
      e: xl.estimaciones.length,
    },
    ejercido,
  )
}

migrate().catch((e) => {
  console.error("ERROR:", e.message)
  process.exit(1)
})
