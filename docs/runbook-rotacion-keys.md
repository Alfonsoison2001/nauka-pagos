# Runbook — Rotación de keys (pre-go-live)

> Objetivo: dejar inservibles todos los secretos que vivieron en `.env.local` durante el
> desarrollo, **antes** de invitar a Jess / José / Marcos / Edy. Bloqueante de go-live.
> Proyecto Supabase: `poesjbliusrdoftibkru`.

## ⚠️ Cambio importante (verificado jun-2026)

Supabase **ya no permite rotar** las keys legacy `anon` / `service_role` como antes (la
rotación del JWT secret está deshabilitada y esas keys se retiran a finales de 2026).
El camino actual es **migrar a las nuevas API keys**:

- `sb_publishable_…` → reemplaza la **anon** (cliente / navegador).
- `sb_secret_…` → reemplaza la **service_role** (servidor, revocable al instante).

Esto es mejor: las nuevas se revocan en segundos sin tirar las sesiones de los usuarios, y
al migrar obtienes secretos nuevos que dejan inservibles los filtrados. En la mayoría de
apps con `@supabase/ssr` son **drop-in**: mismo nombre de variable, valor nuevo.

---

## Qué hay que rotar (5 cosas)

| # | Secreto | Dónde | Tipo |
|---|---------|-------|------|
| A | API keys de Supabase (anon → publishable, service_role → secret) | Dashboard Supabase → API Keys | Migración |
| B | Password de Postgres (hubo leak de rol CLI en transcript) | Dashboard Supabase → Database | Reset |
| C | Token del CLI de Supabase | `supabase login` + revocar el viejo | Re-login |
| D | `RESEND_API_KEY` | Dashboard Resend → API Keys | Rotación |
| E | Network Restrictions (hoy `0.0.0.0/0`) | Dashboard Supabase → Database | Endurecer (opcional/avanzado) |

---

## Orden seguro (para no tirar producción)

Cambiar una key sin actualizar Vercel **rompe prod**. La secuencia por cada secreto es
siempre: **crear el nuevo → actualizar Vercel (y `.env.local`) → redeploy → verificar →
revocar el viejo**. Nunca revoques el viejo antes de confirmar que el nuevo funciona.

Hazlo en una ventana tranquila (nadie usando la app). Total ~30–45 min.

---

## A) Supabase — migrar a las nuevas API keys

1. Dashboard → tu proyecto → **Project Settings → API Keys** (sección de las nuevas keys).
2. **Crea / habilita** la **Publishable key** (`sb_publishable_…`) y una **Secret key**
   (`sb_secret_…`). Copia ambas.
3. En **Vercel → Project → Settings → Environment Variables** (Production **y** Preview):
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → pega la **publishable** (`sb_publishable_…`).
   - `SUPABASE_SERVICE_ROLE_KEY` → pega la **secret** (`sb_secret_…`).
   - Deja `NEXT_PUBLIC_SUPABASE_URL` igual.
4. **Redeploy** en Vercel (Deployments → … → Redeploy, sin caché).
5. **Verifica** (ver checklist final) antes de seguir.
6. Cuando todo funcione con las nuevas: en el dashboard, **deshabilita / revoca las keys
   legacy** (anon y service_role). Eso mata las que se filtraron.

> Nota de código: la app solo usa la service_role para la **Admin API de Auth**
> (`src/lib/supabase/admin.ts`). La secret key nueva funciona ahí sin cambiar código. Si
> algo fallara, es el único punto a revisar.

## B) Supabase — reset del password de Postgres

1. Dashboard → **Project Settings → Database → Database password → Reset / Generate**.
2. Copia el nuevo password (solo se muestra una vez).
3. Si tienes el password en algún `.env` o connection string local, actualízalo. La app en
   Vercel usa supabase-js (no necesita el password de Postgres), así que esto NO requiere
   redeploy — es para cerrar el leak del rol CLI.

## C) Supabase CLI — re-login + revocar token viejo

1. Dashboard → **Account → Access Tokens**: **revoca** el token actual del CLI.
2. En tu máquina: `supabase logout` y luego `supabase login` (genera un token nuevo).
3. Reconfirma el link: `supabase link --project-ref poesjbliusrdoftibkru`.
4. Prueba: `supabase migration list` debe responder sin error.

## D) Resend — rotar API key

1. Dashboard Resend → **API Keys** → crea una nueva → copia (`re_…`).
2. Vercel → Env Vars (Production + Preview): `RESEND_API_KEY` → valor nuevo.
3. **Redeploy**.
4. Verifica que un envío de carátula al pagador sigue saliendo (a tu correo, modo prueba).
5. **Borra** la API key vieja en Resend.

## E) Network Restrictions — opcional / avanzado (déjalo al final)

Hoy está en `0.0.0.0/0` (abierto). Endurecerlo protege el **acceso directo a Postgres**
(CLI, migraciones), **no** afecta a la app, que pega vía supabase-js sobre HTTPS.

⚠️ Cuidado: si lo restringes mal puedes bloquear tus propias migraciones (`supabase db
push`) o el pooler. Recomendación: **déjalo abierto por ahora** o restríngelo solo a tu IP
fija si la tienes. No es bloqueante como las keys; no arriesgues romper deploys por esto.

---

## F) Verificación post-rotación (con las nuevas keys ya en prod)

- [ ] Login a la app en prod funciona (magic link / sesión).
- [ ] Cargar un proyecto: Resumen, Presupuesto, Flujo de Pagos muestran datos.
- [ ] Crear/editar una estimación de prueba (escribe a la DB con las nuevas keys).
- [ ] Generar una carátula PDF (usa el flujo normal).
- [ ] Desactivar/reactivar un usuario de prueba (ejercita la Admin API → secret key).
- [ ] `supabase migration list` responde (CLI re-logueado).
- [ ] Enviar carátula al pagador → llega a tu correo (Resend key nueva).

## G) Limpieza final

- [ ] Borra las 2 líneas huérfanas del bloque "Backup temporal" al final de `.env.local`.
- [ ] Actualiza `.env.local` con los valores nuevos (publishable, secret, resend) para dev.
- [ ] Confirma que las keys legacy quedaron **revocadas** en Supabase.
- [ ] Actualiza `docs/STATE.md`: rotación completa → desbloqueado invitar externos.

---

## Después de esto

Con las keys rotadas + signup off + redirect allow-list + previews protegidos (ya hechos),
queda desbloqueado **invitar a Jess → José → Marcos → Edy**. El tema de emails a terceros
sigue aparte: requiere **verificar el dominio `izarquitectos.mx` en Resend** (DNS).
