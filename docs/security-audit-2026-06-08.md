# Auditoría de seguridad — NAUKA Pagos

> **Fecha:** 2026-06-08 · **Commit auditado:** `a76116a` (8b en `main`)
> **Alcance:** infraestructura, backend, frontend, auth/authz, datos sensibles, rendimiento.
> **Método:** 7 auditores en paralelo (uno por capa + scanner de secretos) + **verificación adversarial** de cada hallazgo crítico/alto/medio (28 agentes; cada hallazgo se re-leyó contra el código real para descartar falsos positivos).
> **Estado:** SOLO REPORTE. No se modificó código. Los fixes van en commits dedicados después.

---

## 🔴 Antes de cargar datos reales y dar acceso a externos (José / Marcos)

**No hay ningún CRÍTICO** (no hay leak de secretos, ni XSS, ni exposición de datos por RLS rota más allá de la decisión consciente de "lectura abierta"). Pero hay **3 hallazgos ALTOS** que sí deben cerrarse **antes** de onboarding de externos + datos reales, porque convierten a un aprobador "solo-lectura" en alguien que puede **escribir/borrar evidencia financiera** o **exfiltrar carátulas**:

1. **[A1] Storage abierto a escritura/borrado para cualquier autenticado** → un externo puede sobrescribir/borrar comprobantes de pago, carátulas firmadas, presupuestos y firmas.
2. **[A2] `enviarCaratula` / `generarCaratula` sin verificación de rol** → un externo puede mandar el PDF de cualquier carátula (con montos) a un correo arbitrario usando el branding de NAUKA.
3. **[A3] Host-header injection en los links de invitación/magic-link** → robo de token de sesión si la allow-list de redirect de Supabase no está acotada.

Y, en paralelo, estas **acciones de dashboard** (no son código) son pre-requisito de go-live: **rotar** las keys (ANON, SERVICE_ROLE, password de Postgres, Resend) que vivieron en `.env.local` durante el desarrollo; **acotar la Redirect URL allow-list** de Supabase Auth a dominios reales; **desactivar signup público**; **proteger los Preview Deployments de Vercel** (hoy pegan a la MISMA base real); confirmar **buckets privados** y **PITR/backups** habilitados.

---

## Resumen ejecutivo

| Severidad | # | Naturaleza |
|---|---|---|
| 🔴 Crítico | 0 | — |
| 🟠 Alto | 3 | Escritura/borrado de archivos por externos · exfiltración de carátulas por correo · host-header injection |
| 🟡 Medio | 9 | Headers de seguridad, integridad de la constancia (columnas/IP), audit log incompleto, soft-delete legible, sin erasure (LFPDPPP), revocación de sesión, 2 de rendimiento |
| 🔵 Bajo | 13 | Defensa en profundidad, fuga de errores, índices, sandbox de iframes, cookies, PII en seed, etc. |
| ⚪ Confirmaciones | 8 | Postura correcta (sin secretos en bundle, sin XSS, Zod server-side, getUser, etc.) |

**Patrón de riesgo dominante:** el endurecimiento por rol de la sub-fase 8a (`tighten_rls_for_roles`) llegó a las **tablas** (escritura = solo admin) pero **NO a Storage ni a algunas Server Actions de carátula**. Resultado: un aprobador externo, que en tablas es solo-lectura, puede escribir/borrar **archivos** y disparar **correos**. Cerrar esa asimetría es el grueso del trabajo pre-go-live.

**Postura base sólida:** sin fugas de secretos (código, historia de git y bundle limpios), sin XSS, validación Zod del lado servidor en las mutaciones, open-redirect mitigado, `getUser()` en middleware, signup abierto prevenido en código.

**Decisión de diseño a re-confirmar:** la visibilidad NO está scopeada por proyecto — un externo invitado como aprobador **lee los 3 proyectos** (montos, contratistas, RFC, pagadores). Fue decisión consciente del dueño; conviene dejarla por escrito en el contrato con GFA.

---

## Hallazgos por severidad

### 🟠 ALTO

#### A1 — Storage: escritura/borrado abierto a cualquier autenticado
- **Ubicación:** `supabase/migrations/20260527002141_initial_schema.sql:335-345` (`storage_auth_full_proyectos`, `storage_auth_full_firmas`).
- **Descripción:** ambas policies son `FOR ALL TO authenticated USING (bucket_id = …)`. `FOR ALL` = SELECT/INSERT/UPDATE/DELETE y el único predicado es el bucket — sin `is_admin()` ni scope por owner/path. La migración de endurecimiento 8a reescribió las 7 tablas operativas pero **nunca tocó `storage.objects`**.
- **Impacto:** un aprobador externo, con la anon-key del browser y su sesión, puede `storage.from('proyectos').remove([...])` / `.upload(..., {upsert:true})` **fuera de la UI**. Las rutas son deterministas (`{projectId}/comprobantes/{estimacionId}`, `{projectId}/presupuestos/{partidaId}.pdf`, `{projectId}/caratulas/{estimacionId}_generada.pdf`) y los IDs son legibles por la lectura abierta → puede **sobrescribir o borrar comprobantes de pago, carátulas firmadas, presupuestos y firmas** de cualquier proyecto. Pérdida de integridad/disponibilidad de evidencia financiera.
- **Fix:** migración que reemplace ambas policies → `SELECT` abierto a `authenticated`; `INSERT/UPDATE/DELETE` con `USING/WITH CHECK (bucket_id = … AND public.is_admin())`. Para el bucket `firmas` (canvas del aprobador en 8e) acotar el `WITH CHECK` al prefijo del propio firmante. **Esfuerzo: M.**

#### A2 — `enviarCaratula` / `generarCaratula` sin `requireAdmin` → exfiltración + abuso de correo
- **Ubicación:** `src/app/proyectos/[id]/caratula/actions.ts:31` (`generarCaratula`), `:69` (`enviarCaratula`). El gate de rol hoy es **solo client-side** (`{isAdmin && …}` en la UI); la Server Action es un endpoint invocable por cualquier sesión.
- **Descripción:** `enviarCaratula` renderiza el PDF de cualquier `estimacionId` y lo envía por Resend a los correos del formulario **sin verificar rol ni acotar destinatarios**, y el envío ocurre **antes** de cualquier escritura en DB. `generarCaratula` sube el PDF a Storage (permitido por A1).
- **Impacto:** un aprobador externo (o cualquier cuenta comprometida) puede **(a)** exfiltrar carátulas (montos, contratista, partida) de cualquier proyecto a un correo arbitrario, y **(b)** usar la infraestructura/branding de NAUKA para enviar PDFs a terceros (phishing/spam). La RLS de tablas no lo frena porque el render lee datos (lectura abierta) y el envío es vía Resend, no Postgres.
- **Fix:** `await requireAdmin()` como primera línea de `generarCaratula` y `enviarCaratula` (igual que `enviarAAprobacion`). Acotar destinatarios a un allow-list (`default_emails` del proyecto + email del pagador) en vez de correos libres. **Esfuerzo: S.**

#### A3 — Host-header injection en `requestOrigin()` (links de invitación / magic-link)
- **Ubicación:** `src/app/login/actions.ts:47-52,69` (`emailRedirectTo`); `src/app/usuarios/actions.ts:19-25,61` (`redirectTo` de `inviteUserByEmail`).
- **Descripción:** `requestOrigin()` construye el origin desde `x-forwarded-host` / `host` (cabeceras controlables por el cliente) y lo usa como base del link que llega por correo.
- **Impacto:** un `Host` manipulado puede apuntar el enlace de confirmación/invitación a un dominio del atacante; si la **Redirect URL allow-list** de Supabase está mal configurada (o con wildcard), se captura el `token_hash`/`code` → secuestro de cuenta/sesión. Aun con allow-list correcta, permite envenenar el enlace mostrado al usuario. La mitigación real depende del allow-list del dashboard — por eso se clasifica alto de forma defensiva.
- **Fix:** usar una env fija `NEXT_PUBLIC_APP_URL` (ya existe en `.env.example`) como base de `redirectTo`/`emailRedirectTo`, en vez del Host del request. + acotar la allow-list en el dashboard (ver Mantenimiento). **Esfuerzo: S.**

### 🟡 MEDIO

#### M1 — Sin headers de seguridad HTTP (CSP, HSTS, X-Frame-Options…)
- **Ubicación:** `next.config.ts` (no define `async headers()`).
- **Impacto:** sin `X-Frame-Options`/`frame-ancestors` hay **clickjacking** del botón de aprobación de un clic (usable por externos); sin CSP, cualquier XSS futuro tiene impacto total. HSTS lo refuerza (Vercel ya fuerza HTTPS).
- **Fix:** `async headers()` para `/(.*)` con HSTS, `X-Frame-Options: DENY` (o CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` y una CSP (probar en report-only primero). **Esfuerzo: S.**

#### M2 — `approvals`: RLS no restringe columnas; el firmante puede falsear su propio voto
- **Ubicación:** `supabase/migrations/20260602040155_add_approvals.sql:124-128` (`approvals_update`) + GRANT UPDATE sin lista de columnas (`:97`).
- **Descripción:** la policy valida QUÉ fila (`firmante_id = my_firmante_id()`) pero RLS no restringe columnas; el control de campos vive solo en el server action. Vía PostgREST directo, un aprobador puede `UPDATE` su fila escribiendo `status='aprobada'` sin motivo, `ip` falsa, `on_behalf`, o votando sobre una solicitud ya resuelta.
- **Impacto:** corrompe la **constancia probatoria** de su propio voto (no la de otros: `approval_requests` sí exige `is_admin()`, y un índice único + el guard evitan re-voto). Importa porque el módulo genera constancias con valor probatorio.
- **Fix:** trigger `BEFORE UPDATE` que, si `NOT is_admin()`, rechace cambios fuera de `{status, motivo, decided_at}` y fuerce `decided_by`/`ip` server-side; o mover la escritura a una función `SECURITY DEFINER` y quitar el `GRANT UPDATE` directo. **Esfuerzo: M.**

#### M3 — Revocación de sesión: desactivar un usuario NO corta su acceso
- **Ubicación:** `src/app/usuarios/actions.ts:112-126` (`setUserActive` solo hace `UPDATE deleted_at` en `profiles`).
- **Descripción:** desactivar marca `deleted_at` en `profiles`, pero **no invalida la sesión** en `auth.users`. El usuario desactivado conserva su JWT y sigue pasando el middleware (lectura abierta a todo lo operativo) hasta que el token expire.
- **Impacto:** si se da de baja a un externo (p.ej. termina la relación con GFA), sigue leyendo los financieros de los 3 proyectos hasta la expiración del token.
- **Fix:** en `setUserActive(false)` llamar a la Admin API (`auth.admin.signOut` / revocar sesiones) además del soft-delete. **Esfuerzo: S.**

#### M4 — `pagadores` y `project_firmantes` sin trigger de audit
- **Ubicación:** `initial_schema.sql` (audit solo en projects, firmantes, contratistas, partidas, estimaciones, profiles, approval_requests, approvals).
- **Impacto:** los cambios de **email del pagador** (a dónde se manda la carátula / el dinero) y de **composición de firmantes** por proyecto no quedan en `audit_log`. Sin rastro de un cambio malicioso/accidental. Agravado por el DELETE duro de `project_firmantes` (sin `deleted_at`).
- **Fix:** migración que agregue triggers `fn_audit_change()` a `pagadores` y `project_firmantes`. **Esfuerzo: S.**

#### M5 — Filas soft-deleted siguen legibles vía RLS
- **Ubicación:** policies `*_select USING (true)` (`tighten_rls_for_roles.sql:27-31`).
- **Descripción:** el `deleted_at` es convención de la app (las queries filtran `.is('deleted_at', null)`); RLS no lo aplica. Vía PostgREST directo un externo lee filas "borradas" (contratistas con RFC/teléfono, estimaciones con montos).
- **Impacto:** el borrado lógico no garantiza privacidad. (Misma clase de datos que el externo ya ve en filas activas por la decisión de lectura abierta; el delta son los registros ocultados por la app.)
- **Fix:** añadir `AND deleted_at IS NULL` a las policies `SELECT` de tablas con PII/financiero (contratistas, partidas, estimaciones, firmantes, pagadores). **Esfuerzo: M.**

#### M6 — Sin procedimiento de borrado real (LFPDPPP/GDPR); PII inmutable en `audit_log`
- **Ubicación:** todas las "eliminaciones" son `UPDATE deleted_at`; `fn_audit_change` guarda `to_jsonb(OLD/NEW)` completo.
- **Impacto:** ante una solicitud de supresión (contratista, externo) no hay mecanismo; la PII (RFC, emails, nombres) persiste en tablas vivas **y duplicada para siempre** en `audit_log.before/after`. Riesgo de cumplimiento con datos reales + terceros.
- **Fix:** definir política de retención + función admin de **anonimización** de campos PII en filas soft-deleted (y su rastro en audit_log) tras X tiempo. Documentar en SPEC.md. **Esfuerzo: M (proceso + código).**

#### M7 — IP de la constancia (`approvals.ip`) es spoofable
- **Ubicación:** `src/app/aprobaciones/actions.ts:25-31` (`clientIp` toma `x-forwarded-for.split(',')[0]`).
- **Impacto:** el primer token de `x-forwarded-for` es el segmento controlable por el cliente → la IP que va en la constancia de aprobación (dato probatorio) no es confiable.
- **Fix:** usar la IP que garantiza el proxy de confianza (Vercel; último hop), o documentar explícitamente que la IP es "mejor esfuerzo", no probatoria. **Esfuerzo: S.**

#### M8 — (Rendimiento) N+1 de URLs firmadas en `/aprobaciones`
- **Ubicación:** `src/app/aprobaciones/page.tsx:406-415` (`createSignedUrl` en `for…of` secuencial).
- **Impacto:** el TTFB de la bandeja (la página que más verán los externos) crece linealmente con el total histórico de carátulas de los 3 proyectos. De ~200ms a varios segundos con decenas.
- **Fix:** paralelizar con `Promise.all`, o firmar on-demand al abrir el preview en vez de para toda la lista. **Esfuerzo: S.**

#### M9 — (Rendimiento) `/aprobaciones` trae todo sin paginar; filtra por proyecto en memoria
- **Ubicación:** `src/app/aprobaciones/page.tsx:70-108` + `fetchCaratulaRequests(sb)` sin `documentIds` ni `limit`.
- **Impacto:** se hace todo el fetch (+ los signed URLs de M8) y luego se filtra por proyecto en memoria; "Resueltas" acumula histórico indefinidamente → degradación progresiva con meses de datos.
- **Fix:** cuando hay `selectedProyecto`, acotar la query por `project_id` (ya indexado); paginar/limitar "Resueltas" (p.ej. últimas 20). **Esfuerzo: M.**

> **Riesgo de diseño aceptado (no es bug):** lectura abierta a todo autenticado, incl. externos, sobre los 3 proyectos (`*_select USING(true)`). Confirmado consciente. Si en el futuro entran aprobadores que deban acotarse a un proyecto, habrá que scopear `SELECT` por membership (`project_firmantes`). **Acción:** dejarlo por escrito en el acuerdo con GFA.

### 🔵 BAJO (commits de cleanup)

- **B1 — Defensa en profundidad por rol ausente en las write-actions de datos** (`createProject`, CRUD de partidas y estimaciones, `uploadComprobante`, todas las de configuración). Hoy la RLS `is_admin()` las cubre (falla cerrado), salvo `uploadComprobante`, que depende de Storage (ver A1). Añadir `await requireAdmin()` al inicio de cada una. **S.**
- **B2 — Fuga de `error.message` crudo de Postgres al cliente** (~24 sitios). Puede revelar nombres de tablas/constraints. Mapear a mensajes genéricos + `console.error` server-side. **S.**
- **B3 — `profiles.firmante_id` sin UNIQUE** → dos perfiles podrían compartir firmante. Añadir índice único parcial `WHERE firmante_id IS NOT NULL AND deleted_at IS NULL` + validar en `inviteUser`. **S.**
- **B4 — Resend en modo prueba** (`RESEND_FROM` cae a `onboarding@resend.dev`). Verificar dominio + setear `RESEND_FROM` en prod; opcional: que `getResendConfig` advierta si `production` sin `RESEND_FROM`. **S (+ dashboard).**
- **B5 — Política de password débil en `config.toml` local** (`minimum_password_length = 6`, sin complejidad). Es config local; **lo que cuenta es el dashboard de prod** — endurecer ahí. **S (dashboard).**
- **B6 — iframes de preview sin `sandbox`** (`caratula-client`, `caratula-preview-button`, `approve-reject-dialog`). Contenido ya es cross-origin de confianza; añadir `sandbox` por defensa. **S.**
- **B7 — Cookie `nauka_last_project` sin `Secure`** (`middleware.ts:68-72`). No es sensible (solo un id de proyecto); añadir `secure` en producción. **S.**
- **B8 — `firmantes` (PII de terceros) legible por todos** (`firmantes_select USING(true)`): nombre/cargo/empresa/email de todos los aprobadores. Cae bajo lectura abierta, pero es PII de contraparte. Evaluar restringir. **S/decisión.**
- **B9 — Emails corporativos reales en el seed** (`20260529201807_seed_firmantes.sql:19-21`) pese a que el comentario dice "PLACEHOLDERS". Corregir el comentario / usar placeholders reales (no se borra del historial sin reescribirlo). **S.**
- **B10 — `.env.example` con el project-ref real** en un comentario (de todos modos es público vía `NEXT_PUBLIC_SUPABASE_URL`). Cosmético: usar placeholder. **S.**
- **B11 — Validación de uploads por `file.type`** (MIME declarado por el cliente), no por magic bytes. Solo admins suben y los buckets son privados; añadir sniffing (`%PDF`) por robustez. **S.**
- **B12 — Índices:** la query global de pendientes (admin, sin `project_id`) no aprovecha `approval_requests_open_idx (project_id, status)` → posible seq scan; `estimaciones.pagador_id` (FK) sin índice. Añadir índice parcial por `status WHERE document_type='caratula'` y `estimaciones(pagador_id)`. Verificar con `EXPLAIN`. **S.**
- **B13 — Self-guards de usuarios solo en server action**, no en RLS; sin invariante de "último admin" (riesgo de lockout vía API directa). Considerar trigger/RPC. **S.**

### ⚪ Confirmaciones (postura correcta — no requieren acción)

- **Sin fugas de secretos:** `service_role`, `RESEND_API_KEY` y password de Postgres **no** aparecen en código trackeado, historia de git, ni en el bundle `.next/static`. `.env.local` está gitignored y nunca commiteado. `supabase/.temp` (pooler-url) gitignored.
- **Sin XSS:** no hay `dangerouslySetInnerHTML`; los `href`/`src` dinámicos usan UUIDs/rutas internas; `window.open` con `noopener,noreferrer`.
- **Secretos server-only:** ningún `"use client"` (41 revisados) importa `env-server` ni `supabase/admin`. El service_role solo se usa para la Admin API de Auth.
- **Validación server-side:** cada mutación valida con Zod en el servidor (la capa cliente es adicional).
- **Open-redirect mitigado:** `/auth/confirm` y `/auth/callback` sanitizan `next` (`/` y no `//`).
- **Middleware:** usa `getUser()` (valida contra Auth), no `getSession()`.
- **Signup abierto prevenido en código:** `signInWithOtp({ shouldCreateUser: false })` + alta solo por `inviteUser` (Admin API, `requireAdmin`). *(Confirmar el toggle en dashboard.)*
- **Email de carátula:** interpolación JSX auto-escapada (`@react-email`), sin inyección. CI sin secretos.

---

## Plan de remediación priorizado

### Fase 0 — Antes de datos reales / externos (bloqueante)
| # | Acción | Tipo | Esfuerzo |
|---|---|---|---|
| 1 | **A1** — migración: Storage write/delete solo `is_admin()` (SELECT abierto) | migración | M |
| 2 | **A2** — `requireAdmin()` en `generarCaratula`/`enviarCaratula` + allow-list de destinatarios | código | S |
| 3 | **A3** — usar `NEXT_PUBLIC_APP_URL` en vez del Host header | código | S |
| 4 | **M1** — headers de seguridad (`next.config.ts`) | código | S |
| 5 | **M3** — revocar sesión al desactivar usuario | código | S |
| 6 | **Dashboard must-dos** — rotar keys; acotar redirect allow-list; desactivar signup público; proteger Preview Deployments; confirmar buckets privados + PITR | dashboard | M |

### Fase 1 — Commits de cleanup (post-go-live cercano)
M2 (columnas de approvals), M4 (audit triggers), M5 (soft-delete en RLS), M7 (IP), M8+M9 (rendimiento de /aprobaciones), B1 (`requireAdmin` en todas las write-actions), B2 (errores), B3, B6, B7, B12 (índices).

### Fase 2 — Largo plazo / proceso
M6 (política de retención + erasure/anonimización — LFPDPPP), B5/B13 (password policy + invariante último-admin + 2FA), B8 (scoping de PII si cambia el modelo), documentar la decisión de lectura abierta en SPEC.md y en el acuerdo con GFA.

---

## Análisis de rendimiento

- **N+1 de signed URLs (M8)** y **falta de paginación (M9)** en `/aprobaciones` son los dos puntos reales: la página más usada por externos hace una firma de Storage en serie por carátula histórica y filtra en memoria. Arreglo: `Promise.all` + acotar query por `project_id` + paginar "Resueltas".
- **Índices (B12):** el badge global de pendientes (admin) filtra `status` sin `project_id` → no usa `approval_requests_open_idx (project_id, status)`; `estimaciones.pagador_id` sin índice. Validar con `EXPLAIN ANALYZE` (hoy el volumen es bajo, no urgente).
- **Waterfalls:** Flujo y Carátula encadenan ~6-7 queries secuenciales por render; margen para `Promise.all` en bloques independientes. Bajo impacto hoy.
- **Falso positivo descartado:** "revalidatePath no invalida Resumen/Home" → no aplica: esas páginas son dinámicas (usan `cookies()`), se re-renderizan en cada request, no muestran datos stale.
- **RSC vs cliente:** uso correcto (41 client components, todos con interacción real). `@react-pdf/renderer` bien aislado en `serverExternalPackages`. `<img>` del logo aceptable (estático/pequeño).
- **Limpieza:** `@tanstack/react-table` está declarado pero no se usa (tablas a mano, que para SSR es más liviano). Decidir: adoptarlo o retirar la dependencia.

---

## Mantenimiento y verificaciones de dashboard (consolidado)

**Supabase — Auth:** acotar **Redirect URL allow-list** a prod/preview exactos (mitiga A3); **desactivar signup público**; activar **Leaked password protection**; subir password policy (≥10 + complejidad); acortar **OTP/magic-link expiry** y confirmar single-use; confirmar **rate limits**; evaluar **MFA/2FA para admins**.
**Supabase — DB/Storage:** habilitar **PITR/backups** (datos financieros sin hard-delete); confirmar **buckets `proyectos`/`firmas` privados**; **Enforce SSL**; evaluar **Network Restrictions** (hoy `0.0.0.0/0`); confirmar que **service_role no tiene grants de tabla**; verificar que los triggers de audit y los índices estén realmente aplicados en prod.
**Vercel:** confirmar `SUPABASE_SERVICE_ROLE_KEY`/`RESEND_API_KEY` **server-only** (sin `NEXT_PUBLIC_`); setear `NEXT_PUBLIC_APP_URL` y `RESEND_FROM`; **proteger Preview Deployments** (pegan a la base real); validar headers de seguridad post-deploy (securityheaders.com).
**Resend:** verificar dominio `izarquitectos.mx` (SPF/DKIM/DMARC) + `RESEND_FROM=caratulas@izarquitectos.mx`; API key con permiso mínimo (Send).
**Higiene pre-go-live:** **rotar** ANON key, SERVICE_ROLE key, password de Postgres y RESEND key (vivieron en `.env.local` durante el desarrollo); depurar cuentas/firmantes de prueba.

---

## Orden de trabajo propuesto

1. **Hoy / antes de externos:** un commit por cada ALTO + M1 + M3 (Fase 0, código) → validar → push → verificar. En paralelo, tú haces los **dashboard must-dos** (rotación de keys, allow-list, signup, previews, PITR).
2. **Esta semana:** commits de cleanup (Fase 1), agrupados por tipo (1 migración para audit triggers + soft-delete RLS + columnas de approvals; 1 commit de `requireAdmin` en todas las actions; 1 commit de rendimiento de /aprobaciones).
3. **Largo plazo:** Fase 2 (retención/erasure, 2FA, documentación de la decisión de lectura abierta).

> Cada fix irá en su commit dedicado, con su validación (biome + tsc + build) y verificación en localhost antes de push, igual que el resto del proyecto. **No se cambió nada en esta auditoría.**
