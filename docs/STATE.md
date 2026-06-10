# STATE — NAUKA Pagos

> Snapshot de handoff · **2026-06-10** · rama `main` @ `c9ee75a` · Flujo ágil de aprobaciones (9 features) en prod, Vercel verde · Fase 0 security (código) COMPLETA

## Dónde estamos AHORA MISMO

**Sesión 2026-06-10 — Flujo ágil de aprobaciones (9 features en 9 commits) COMPLETA, todo verde en Vercel.** Working tree limpio, nada en vuelo. (Más temprano en la semana: Fase 0 del security audit — 4 fixes en prod, tabla abajo.)

### Esta sesión: 9 features (Bloques A/B/C), un commit cada una

| # | Feature | Commit |
|---|---|---|
| A1 | Cancelar solicitud de aprobación en curso (admin) — votos quedan en historial, carátula vuelve a Generada | `624593d` |
| A2 | Eliminar del historial rondas canceladas/rechazadas (admin; aprobadas nunca) | `efc577b` |
| A3 | Bloquear edición de estimación con aprobación en curso (server + UI + cancelar inline) | `225d331` |
| B4 | Enviar a aprobación al crear carátula (checkbox default ON en "+ Nueva carátula") | `a132dc9` |
| B5 | Sugerir marcar Enviada de un clic tras enviar al pagador | `cbac384` |
| B6 | Subir comprobante inline al marcar Pagada (un solo guardado) | `2ba2267` |
| B7 | Copiar link de la bandeja para compartir por WhatsApp | `09754b4` |
| C8 | Quitar comprobante (admin only) en la celda del Flujo | `852e806` |
| C9 | Página `/guia` "¿Cómo funciona?" (sidebar, todos los roles) | `c9ee75a` |

**Migración nueva (única de la sesión):** `20260610185323_add_cancel_fields_approval_requests` — columnas aditivas nullable `approval_requests.canceled_by` (uuid → auth.users) + `cancel_motivo` (text). Aplicada a prod con `supabase db push`. Sin cambios de RLS/grants (la policy UPDATE admin existente las cubre).

**El flujo ágil quedó así:** capturar → aprobar en **1 paso** (checkbox "Enviar a aprobación al guardar" default ON: `createEstimacion → generarCaratula → enviarAAprobacion`); el admin puede **cancelar** una solicitud en curso y **eliminar** del historial rondas canceladas/rechazadas; **editar con aprobación en curso está bloqueado** (validación en el server action + banner/cancelar en la UI); tras enviar al pagador se **sugiere marcar Enviada** de un clic; al marcar **Pagada** se adjunta el **comprobante inline** en el mismo guardado; **"Copiar link"** comparte la bandeja por WhatsApp; **quitar comprobante** (admin); y la **guía publicada** en `/guia` documenta todo el proceso ya con estas features.

**Infra compartida nueva (para el próximo que toque aprobaciones):** `DocumentApproval.openRequestId` (id de la ronda abierta) · `TimelineRound.requestId` + `canceledByNombre`/`cancelMotivo` · `ApprovalSummary.openRequestId` · `fetchCaratulaRequests` resuelve `canceled_by`→nombre vía `profiles` · la página de Flujo de Pagos ahora obtiene `isAdmin` (threaded a tabla → celdas) · componentes nuevos en `src/components/approvals/`: `cancelar-aprobacion-button`, `eliminar-ronda-button`, `copiar-link-button`.

### Previo en la semana — Fase 0 security (código), 4 fixes

| # | Fix | Hash | Estado |
|---|---|---|---|
| 1 | fix(security-A1): storage write/delete solo admin (migración `20260609201429_harden_storage_rls`, aplicada a prod vía `supabase db push`) | `33128c1` | ✅ verde |
| 2 | fix(security-A3): usar NEXT_PUBLIC_APP_URL en auth redirects | `c01f70e` | ✅ (ver nota) |
| 3 | feat(security-M1): security headers | `9e366b2` | ✅ verde |
| 4 | fix(security-M3): revocar sesión al desactivar usuario | `823dd93` | ✅ verde |

**Nota A3:** Vercel no creó deployment para `c01f70e` (webhook perdido, transitorio — único caso en el repo); su código viajó y quedó verde en el deploy de M1 (`9e366b2`). M1 y M3 desplegaron normal después. No requiere acción.

**As-built de los 4 fixes:**
- **A1:** policies nuevas `storage_proyectos_{select,insert,update,delete}` y `storage_firmas_*` reemplazan a las 2 `FOR ALL` de initial_schema. SELECT abierto a authenticated; write/delete `public.is_admin()`. `firmas` deja prevista escritura de aprobador SOLO bajo su prefijo `{firmante_id}/…` (para el canvas 8e; hoy inerte — nada escribe ese bucket). Solo policies, grants intactos (sin 42501). Revisión adversarial pre-push con 3 lentes (RLS correctness / Storage gotchas / regresión admin): SAFE TO PUSH unánime.
- **A3:** `requestOrigin()` (Host header, spoofeable) → `appOrigin()` desde `NEXT_PUBLIC_APP_URL`, en `login/actions.ts` (magic-link) y `usuarios/actions.ts` (invitación). Alfonso confirmó la env en Vercel Production ANTES del push. Fallback localhost solo dev.
- **M1:** `async headers()` en `next.config.ts` para `/(.*)`: HSTS (2 años + includeSubDomains), X-Frame-Options DENY, nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy mínima. **CSP en Report-Only a propósito** (observar violaciones antes de enforce; permite `'unsafe-inline'` de Next/Tailwind y orígenes `*.supabase.co`). Verificado local con curl: los 6 headers se emiten.
- **M3:** `setUserActive(false)` ahora banea el auth.user vía Admin API (`updateUserById`, `ban_duration: "876000h"`); reactivar = `"none"`. NO se usó `admin.signOut` — requiere el JWT del propio usuario y auth-js 2.106.2 no tiene signOut-por-id. El ban corta refresh, logins nuevos y `getUser()` del middleware al instante. El cliente admin se valida ANTES de mutar (sin estados parciales).

## Cómo quedó el rediseño Carátula (as-built)

- **Layout:** grupos por contratista ordenados por Σ `presupuesto_con_iva` desc (alinea con Resumen) → fila HORIZONTAL de cards (260px, `overflow-x-auto`) + card dashed "+ Nueva carátula para [contratista]" al final de cada fila.
- **Card:** # Estimación · partida · monto (tabular-nums #163D4A) + c/IVA o s/IVA · fecha · pagador · badge **Pago** (`EstatusBadge`) · badge **Carátula** híbrido · footer **Generar** (sin generar) / **Ver** (generada) / **Descargar** (aprobada).
- **Badge Carátula híbrido (P2):** Sin generar (gris) → Rechazada (rojo) → En aprobación N/M (amber; N=aprobados, M=total de la ronda) → **Aprobada [+ sub "· Enviada"]** (verde) → Enviada (azul) → Generada (gris). `caratula-badge.tsx`.
- **"Ver":** abre `<CaratulaDetailDialog>` (modal ~56rem) con preview PDF + TODAS las acciones: generar/regenerar, enviar al pagador / sin aprobación, enviar/reenviar a aprobación, revisar y firmar, decidir por X, borrar, historial/timeline.
- **Mini-modal "+ Nueva carátula":** partida (dropdown del contratista) · # · monto sin IVA + checkbox "Agregar IVA 16%" · fecha · pagador. Status default `pendiente` (sin dropdown). Concepto/Notas null. Al guardar: `createEstimacion` (devuelve id) → `generarCaratula` automático → `router.refresh()`.

**3 ajustes de implementación (Alfonso los aceptó 2026-06-09):**
1. **Sin kebab por card.** El spec (§4) pedía un kebab ⋯ con Enviar a aprobación/Regenerar/Borrar; en su lugar TODAS las acciones secundarias viven en el modal "Ver" (a un clic, con sus confirmaciones). Cero duplicación de lógica. El kebab de accesos rápidos queda como follow-up opcional.
2. **Grupos = contratistas con ≥1 estimación** (igual que el selector viejo). La primera carátula de un contratista nuevo se crea desde Flujo de Pagos; "+ Nueva" agrega a contratistas que ya aparecen.
3. **"Enviar a aprobación" ahora hace `router.refresh()`** al instante (el panel inline viejo no refrescaba). Mejora, no regresión.

Componentes nuevos (en `src/app/proyectos/[id]/caratula/`): `caratula-badge.tsx`, `caratula-estimacion-card.tsx`, `nueva-caratula-dialog.tsx`, `caratula-contratista-group.tsx`, `caratula-detail-dialog.tsx`. Acción nueva `getCaratulaSignedUrl` (descarga). `createEstimacion` ahora devuelve `estimacionId`.

## Qué está en producción (Vercel verde hasta 823dd93)

- App completa: Home con 3 project cards, 6 tabs por proyecto, carátula PDF + Resend, aprobaciones in-platform (8a `cc40ecd` + 8b `a76116a`), `/auth/recovery` (`ca388f2`), design system NAUKA, **tab Carátula rediseñada a cards**, **Fase 0 security (A1 `33128c1` + A3 `c01f70e` + M1 `9e366b2` + M3 `823dd93`)**, **flujo ágil de aprobaciones 2026-06-10 (cancelar/eliminar rondas, envío directo al crear, guard de edición, comprobante inline, copiar link) + guía `/guia`**.
- **Lote 44 con DATA REAL**: 6 contratistas (SAMSTORGAM, Hector Triana, ABIKAR, Urarq, Aquaconcepts, TENCO), 6 partidas, 7 estimaciones todas pagadas, **ejercido $647,748.01 (cuadra al centavo con el Excel)**. Test data (CYVSA, R&R Imper) soft-deleted + storage huérfano limpiado (`592443f`).
- Sesión 2026-06-08/09: `851286b` fecha presupuesto editable · `2d7ec46` resumen ordenado desc · `dcda9af` borrar/regenerar carátula + fix A2 · `c275c57` fix dropdowns UUID→nombre · `b49c4fb` labels capitalizados Status/IVA · rediseño Carátula `8fd1024`→`d15b18e`.
- Sesión 2026-06-09/10: Fase 0 security — A1 `33128c1` · A3 `c01f70e` · M1 `9e366b2` · M3 `823dd93`.
- Sesión 2026-06-10: flujo ágil de aprobaciones (9 features) — A1 `624593d` · A2 `efc577b` · A3 `225d331` · B4 `a132dc9` · B5 `cbac384` · B6 `2ba2267` · B7 `09754b4` · C8 `852e806` · C9 `c9ee75a` + migración `20260610185323` (canceled_by/cancel_motivo).

## Seguridad (audit `docs/security-audit-2026-06-08.md`)

- **Fase 0 (código) CERRADA:** A1 (`33128c1`) · A2 (`dcda9af`) · A3 (`c01f70e`) · M1 (`9e366b2`) · M3 (`823dd93`). Quedan Fase 1 (M2, M4–M9, B1–B13 — "esta semana" según el audit, agrupados) y Fase 2 (retención/erasure, 2FA, documentar lectura abierta con GFA).
- **Verificaciones manuales pendientes (Alfonso, ~10 min):** A1 → como admin: generar/enviar/borrar/regenerar carátula, subir PDF de presupuesto, subir comprobante, subir logo (si algo da "violates row-level security" o 403, reportar). A3 → mandar magic-link o invitación de prueba y confirmar que el enlace del correo apunta al dominio prod. M1 → securityheaders.com contra prod + vigilar consola del navegador por reportes CSP (report-only) en uso normal; cuando esté limpia, decidir enforce. M3 → con una segunda cuenta (no aplica sobre uno mismo): desactivar → la sesión muere al instante; reactivar → vuelve a entrar.
- Dashboard hardening hecho: signup off, redirect URLs acotadas, Site URL prod, Vercel preview protection, buckets privados, password de Alfonso cambiada vía `/auth/recovery`, password policy ≥12.
- **BLOQUEANTE antes de invitar externos (José/Marcos):** SOLO queda **rotar TODAS las keys** (ANON, SERVICE_ROLE, password Postgres —hubo leak de rol CLI en transcript—, RESEND) + re-`supabase login` + Network Restrictions ≠ 0.0.0.0/0. Memoria `pre-rotation-security-checklist`. (A1+A3+M1+M3 ya cerrados en código.)
- ✅ `.env.local`: `BACKUP_ADMIN_EMAIL/PASSWORD` BORRADAS (2026-06-09, cierre de migración). Quedan solo keys reales (Supabase + Resend). Los scripts de migración/backup ya no corren — migración one-shot completa. (Nota menor: quedaron 3 líneas de comentario huérfanas del bloque BACKUP en `.env.local`; inocuas.)

## Notas operativas clave

- `scripts/migration/migrate-lote-44.mjs` es **ONE-SHOT para L44**: re-correr `--commit` revertiría ediciones manuales en la app (ej. Finiquito Urarq ajustado a 185,953.61 para cerrar partida en 0). Para BF/L3: clonar el script y correr ANTES de editar nada en la app.
- service_role NO tiene grants de tabla (solo Admin API de Auth). Backup/import van por sesión admin (`signInWithPassword`).
- Backup restore point: `backups/pre-migration-2026-06-08.zip` (11 tablas JSON+CSV) + esquema en `supabase/migrations/`.
- Bug recurrente de Selects: base-ui `<Select>` necesita prop `items` (mapa value→label) o el trigger muestra el value crudo. Proyecto auditado (`c275c57` + `b49c4fb`); los Selects nuevos del rediseño ya lo traen.
- Aprobación es ortogonal al status de pago (manual: pendiente/enviada/pagada). Carátula se envía al PAGADOR, no al contratista.

## PENDIENTES (en orden sugerido)

1. Confirmar sentido de barras del Resumen (¿la más grande arriba? si no: `reversed` en YAxis, 1 línea).
2. **Auditoría de calidad anti-vibe-coding** (prompt de 10 dimensiones redactado en conversación previa; Alfonso decide cuándo). Output: `docs/audit-quality-2026-06-XX.md`.
3. Alfonso sube PDFs de presupuestos firmados de L44 por la UI (manual, ~10 min).
4. Verificación manual de los 4 fixes de Fase 0 (lista en sección Seguridad, ~10 min). Después, cuando Alfonso diga: Fase 1 del audit (M2, M4–M9, B1–B13, agrupados en ~3 commits).
5. Rotación de keys (checklist en memoria) → recién entonces invitar a Jess→José→Marcos.
6. Migración Beachfront y Lote 3 (clonar script, correr antes de editar en app).
7. Sub-fases 8c+8e (canvas firma + constancia PDF — Alfonso duda si vale la pena) y 8d (notificaciones email + Recordar). Verificar dominio Resend antes de externos.
8. (Opcional) Kebab de accesos rápidos en las cards de Carátula, si se quiere.

## Decisiones que NO hay que re-grilear

2 roles (admin: Alfonso+Jess / aprobador: José+Marcos+Edy) · visibilidad cross-project consciente (todos ven todo; dejarlo por escrito con GFA) · firmantes globales compartidos entre proyectos · status de pago 100% manual · una sola fecha (`fecha_estimacion`) · sin EOM · IVA por estimación = checkbox 16% (iva_pct 0 o 0.16, monto tecleado = lo que cuenta) · acumulado de carátula = todas las estimaciones fecha ≤ esta incluyéndola sin importar status · loop grill-me → openspec → aprobar → implementar · regression prevention de CLAUDE.md es ley · rediseño Carátula: 3 ajustes as-built aceptados (ver arriba) · Fase 0 as-built: M3 = ban vía Admin API (auth-js sin signOut-por-id) · CSP report-only primero, enforce después de observar · A3 ancla redirects a NEXT_PUBLIC_APP_URL · cancelar guarda quién/por qué en columnas nuevas de approval_requests (Alfonso eligió migración aditiva sobre la versión sin persistencia, 2026-06-10) · guard de edición valida en el server action (no solo UI) · sugerencias de status (Enviada) y comprobante inline NO cambian que el status de pago siga siendo manual.
