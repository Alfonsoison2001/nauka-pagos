# Prompt — Auditoría de calidad anti-vibe-coding (read-only)

> Pégalo en una sesión NUEVA de Claude Code. Modelo recomendado: **Opus 4.8 Max**.
> Es read-only: NO debe tocar código, solo diagnosticar.

---

Sesión nueva. Lee CLAUDE.md y docs/STATE.md (2026-06-10), corre `git log --oneline -15 && git status --short`, y confirma el contexto en 1 párrafo.

OBJETIVO DE ESTA SESIÓN: auditoría de calidad **read-only** del proyecto. NO escribas ni
modifiques una sola línea de código de la app. NO corras grill-me ni openspec. NO hagas
"arreglos rápidos". Tu único entregable es un reporte de hallazgos. Si te dan ganas de
arreglar algo, anótalo como hallazgo, no lo toques.

ENTREGABLE: crea `docs/audit-quality-2026-06-16.md` con:
- Un **resumen ejecutivo** (5–8 líneas): salud general del proyecto y los 3 riesgos más
  importantes.
- Hallazgos agrupados por las 10 dimensiones de abajo. Cada hallazgo con: **severidad**
  (🔴 Crítico / 🟠 Alto / 🟡 Medio / ⚪ Bajo), **archivo:línea**, qué está mal, por qué
  importa, y la **recomendación concreta** (sin implementarla).
- Una **tabla final priorizada** (todos los hallazgos ordenados por severidad) para decidir
  qué atacar primero.

REGLAS DE RIGOR:
- Verifica cada afirmación leyendo el archivo real; cita `archivo:línea`. Cero suposiciones,
  cero alucinaciones. Si no estás seguro, márcalo como "a confirmar".
- Distingue entre hallazgo real y preferencia de estilo. Prioriza lo que afecta
  correctitud, seguridad o integridad de datos financieros.
- No reportes como bug las decisiones conscientes documentadas en STATE.md (sección
  "Decisiones que NO hay que re-grilear"): lectura cross-project abierta, status de pago
  manual, IVA por checkbox, M3 = ban vía Admin API, CSP report-only, etc.

LAS 10 DIMENSIONES A AUDITAR:
1. **Correctitud e integridad de datos.** Matemática de dinero (IVA 16%, acumulados de
   carátula, finiquitos), `numeric(14,2)` sin floats, consistencia de soft-delete
   (`deleted_at`) entre estimaciones / carátulas / rondas de aprobación, que no queden
   datos huérfanos.
2. **Seguridad y RLS.** Políticas RLS por rol, uso de `service_role` (solo Admin API),
   secretos server-only (ningún `"use client"` importa `env-server`/`supabase/admin`),
   storage write/delete solo admin, validación de uploads (tipo + tamaño).
3. **Type safety.** Strict mode, uso de `any` (debe estar justificado), tipos de retorno de
   server actions, tipos de filas de Supabase.
4. **Manejo de errores y edge cases.** Notif/email best-effort (try/catch que no rompa la
   acción), estados vacíos, fallos de red, qué pasa si falta RESEND_API_KEY, PDFs que no
   generan, listas vacías.
5. **Fronteras server/client.** Server Components por default, `"use client"` solo donde hay
   interacción, mutaciones por Server Actions, queries protegidas vía el helper SSR.
6. **Esquema de DB y migraciones.** FKs siempre, constraints, triggers de audit aplicados en
   prod, `id uuid` + `created_at`, sin DELETE duro, migraciones aditivas y reversibles.
7. **Fidelidad al modelo mental del Excel.** Labels y nombres de columnas exactos (Resumen,
   Presupuesto, Flujo de Pagos, Carátula, etc.), sin nombres inventados ni traducidos, las
   6 tabs en orden.
8. **Estructura y mantenibilidad.** Funciones/componentes ≤80 líneas, duplicación de lógica,
   naming (kebab/Pascal/camel), código muerto, `console.log` en producción.
9. **Performance.** Queries N+1, refetch innecesario, `router.refresh()` de más, payloads
   grandes al cliente, índices faltantes para los filtros del Flujo.
10. **Robustez de UX.** Validación con Zod en cliente **y** server, formato de dinero
    (`es-MX`, tabular-nums) y fechas (`dd/mm/yyyy`), responsive donde aplica, el bug de
    Selects de base-ui (prop `items`), accesibilidad básica.

ENFOQUE ESPECIAL (revisa con lupa, es lo más nuevo y menos probado):
- El flujo de aprobaciones y la sub-fase 8d (notificaciones + emails): `src/lib/approvals/`,
  `src/lib/email/`, los server actions de aprobar/rechazar/cancelar/eliminar/recordar, y la
  exclusión de rondas de estimaciones soft-deleted.
- El envío de emails: el `to:` de múltiples admins en modo prueba de Resend (causa probable
  de que no lleguen correos) — confírmalo como hallazgo con su fix recomendado.

Al terminar: NO commitees código. Puedes commitear SOLO el reporte nuevo con
`docs(audit): auditoría de calidad 2026-06-16`. Dame al final el resumen ejecutivo y la
tabla priorizada en el chat.
