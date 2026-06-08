# STATE — NAUKA Pagos

> Snapshot de fin de sesión · **2026-06-08** · rama `main`

## Dónde estamos

- **8a (fundaciones multi-usuario)** y **8b (núcleo de aprobaciones + ajustes UX)** — commiteados, deployados, verdes en Vercel.
- **Auditoría de seguridad completada.** Documento: [`docs/security-audit-2026-06-08.md`](./security-audit-2026-06-08.md).
  - Resultado: **0 críticos · 3 ALTOS · 9 MEDIOS · 13 BAJOS** + confirmaciones de postura correcta (sin leak de secretos, sin XSS, Zod server-side).
  - Método: 7 auditores en paralelo + verificación adversarial (28 agentes).
- **`/auth/recovery` (reset de contraseña) deployado** — commit `ca388f2`, Vercel verde.
- **Hardening de dashboard aplicado hoy** (Auth → URL config para el flujo de recovery; ver checklist completo en el doc de auditoría → §Mantenimiento). La **rotación de keys sigue pendiente** (ver abajo).
- **Password de Alfonso ya cambiada vía dashboard.**

## Commits clave

| Commit | Qué |
|---|---|
| `cc40ecd` | feat(aprobaciones): 8a fundaciones multi-usuario |
| `a76116a` | feat(aprobaciones): 8b núcleo de aprobaciones + ajustes UX |
| `ca388f2` | feat(auth): página /auth/recovery (reset de contraseña) |

## PENDIENTE (próxima sesión)

1. **Fase 0 — fixes de código de la auditoría** (antes de externos/datos reales), un commit por hallazgo:
   - **A1** — Storage RLS: `INSERT/UPDATE/DELETE` solo `is_admin()` (hoy `FOR ALL` abierto a cualquier autenticado).
   - **A2** — `requireAdmin()` en `generarCaratula` / `enviarCaratula` + allow-list de destinatarios.
   - **A3** — usar `NEXT_PUBLIC_APP_URL` en vez del Host header en `requestOrigin()` (login/inviteUser).
   - **M1** — headers de seguridad (CSP/HSTS/X-Frame-Options) en `next.config.ts`.
   - **M3** — revocar la sesión al desactivar un usuario (`setUserActive`).
2. **Rotar keys** antes del go-live: ANON, SERVICE_ROLE, password de Postgres, RESEND_API_KEY (vivieron en `.env.local` durante el desarrollo). Re-cargar en Vercel + `.env.local`.
3. **Migración de datos reales — NAUKA Lote 44** (Excel → Supabase).
4. **Sub-fase 8c + 8e** — canvas de firma + constancia anexa en el PDF de la carátula (spec ya acordada en `docs/changes/day-8-aprobaciones.md`).

### Pendientes menores ya identificados
- Doc de auditoría: resto de hallazgos MEDIO/BAJO en Fase 1 (audit triggers `pagadores`/`project_firmantes`, soft-delete legible vía RLS, paginación/N+1 en `/aprobaciones`, `requireAdmin` defensivo en todas las write-actions, índices).
- Long-term: política de retención/erasure (LFPDPPP), 2FA para admins.
- Opcional UI: link "¿Olvidaste tu contraseña?" en `/login` que dispare `resetPasswordForEmail` (hoy el correo de recovery solo se manda desde el dashboard).

## Próximo paso

**Nuevo chat para la migración del Excel de Lote 44** a Supabase (datos reales).
