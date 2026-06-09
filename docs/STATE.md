# STATE — NAUKA Pagos

> Snapshot de handoff · **2026-06-09 (tarde)** · rama `main` @ `d15b18e` · rediseño Carátula COMPLETO, verificado en prod por Alfonso

## Dónde estamos AHORA MISMO

**Rediseño tab Carátula COMPLETO — los 4 commits verdes en Vercel.** Working tree limpio, nada en vuelo.

El plan vivió en `docs/changes/rediseno-caratula-cards.md`. Los 4 commits:

| # | Commit | Hash | Estado |
|---|---|---|---|
| 1 | feat(caratula-redesign): backend prep (extiende createEstimacion + query) | `8fd1024` | ✅ verde |
| 2 | refactor(caratula): extract CaratulaDetailDialog reusable component | `1afef8e` | ✅ verde |
| 3 | feat(caratula-redesign): card components | `8b58805` | ✅ verde |
| 4 | feat(caratula-redesign): cards horizontales agrupadas por contratista | `d15b18e` | ✅ verde |

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

## Qué está en producción (Vercel verde hasta d15b18e)

- App completa: Home con 3 project cards, 6 tabs por proyecto, carátula PDF + Resend, aprobaciones in-platform (8a `cc40ecd` + 8b `a76116a`), `/auth/recovery` (`ca388f2`), design system NAUKA, **tab Carátula rediseñada a cards**.
- **Lote 44 con DATA REAL**: 6 contratistas (SAMSTORGAM, Hector Triana, ABIKAR, Urarq, Aquaconcepts, TENCO), 6 partidas, 7 estimaciones todas pagadas, **ejercido $647,748.01 (cuadra al centavo con el Excel)**. Test data (CYVSA, R&R Imper) soft-deleted + storage huérfano limpiado (`592443f`).
- Sesión 2026-06-08/09: `851286b` fecha presupuesto editable · `2d7ec46` resumen ordenado desc · `dcda9af` borrar/regenerar carátula + fix A2 · `c275c57` fix dropdowns UUID→nombre · `b49c4fb` labels capitalizados Status/IVA · rediseño Carátula `8fd1024`→`d15b18e`.

## Seguridad (audit `docs/security-audit-2026-06-08.md`)

- 0 críticos · 3 ALTOS: **A2 CERRADO** (`dcda9af`) · **A1 (Storage RLS write/delete abierto) PENDIENTE** · **A3 (host-header en redirects) PENDIENTE** · M1 (headers seguridad) y M3 (revocar sesión) pendientes · 9 medios · 13 bajos.
- Dashboard hardening hecho: signup off, redirect URLs acotadas, Site URL prod, Vercel preview protection, buckets privados, password de Alfonso cambiada vía `/auth/recovery`, password policy ≥12.
- **BLOQUEANTE antes de invitar externos (José/Marcos):** cerrar A1+A3+M1+M3 + **rotar TODAS las keys** (ANON, SERVICE_ROLE, password Postgres —hubo leak de rol CLI en transcript—, RESEND) + re-`supabase login` + Network Restrictions ≠ 0.0.0.0/0. Memoria `pre-rotation-security-checklist`.
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
4. Fase 0 restante del security audit: A1, A3, M1, M3 (un commit por hallazgo).
5. Rotación de keys (checklist en memoria) → recién entonces invitar a Jess→José→Marcos.
6. Migración Beachfront y Lote 3 (clonar script, correr antes de editar en app).
7. Sub-fases 8c+8e (canvas firma + constancia PDF — Alfonso duda si vale la pena) y 8d (notificaciones email + Recordar). Verificar dominio Resend antes de externos.
8. (Opcional) Kebab de accesos rápidos en las cards de Carátula, si se quiere.

## Decisiones que NO hay que re-grilear

2 roles (admin: Alfonso+Jess / aprobador: José+Marcos+Edy) · visibilidad cross-project consciente (todos ven todo; dejarlo por escrito con GFA) · firmantes globales compartidos entre proyectos · status de pago 100% manual · una sola fecha (`fecha_estimacion`) · sin EOM · IVA por estimación = checkbox 16% (iva_pct 0 o 0.16, monto tecleado = lo que cuenta) · acumulado de carátula = todas las estimaciones fecha ≤ esta incluyéndola sin importar status · loop grill-me → openspec → aprobar → implementar · regression prevention de CLAUDE.md es ley · rediseño Carátula: 3 ajustes as-built aceptados (ver arriba).
