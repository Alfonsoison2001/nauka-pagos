# Change Proposal — Fase 1 post-MVP: Módulo de Aprobaciones in-platform

> Estado: **PENDIENTE DE APROBACIÓN**. No se escribe código hasta que Alfonso apruebe.
> Fecha: 2026-06-01
> Tamaño: **el módulo más grande hasta hoy.** Implementación propuesta en 5 sub-fases
> (8a–8e), cada una un PR revisable con su checklist de regresión.

---

## 1. Objetivo

Convertir la app (hoy de uso interno: Alfonso + Jessica) en una **plataforma multi-usuario
con flujo de aprobación in-platform**. José Ison, Marcos Fasja, Edy Rodríguez y Jess entran
con su propia cuenta y **aprueban o rechazan carátulas directamente en la plataforma**,
reemplazando el ping-pong de PDF firmado por correo. Al aprobarse, se genera una
**constancia automática** ("Aprobado por X el día Y a las HH:MM" + IP + sello) anexa al PDF.

**En scope (Fase 1):**
- 2 roles: **admin** (Alfonso, Jess) y **aprobador** (José, Marcos, Edy).
- Invitación por **magic link** desde una pantalla admin **Usuarios**.
- Aprobación **solo de Carátulas**, con un **modelo de datos genérico** (presupuestos /
  cotizaciones se enchufan después sin re-migración grande).
- Los **3 firmantes del proyecto** aprueban; **aprobación parcial visible** ("1 de 3").
- Firma con **botón "Aprobar" + canvas de firma opcional**.
- **RLS por rol**: aprobador = solo lectura en operativo + escribe solo su voto.
- Notificaciones: **email para lo accionable** + **badge in-app para todo**.
- **Bandeja global** `/aprobaciones` + **estado inline** en la pestaña Carátula.
- **Constancia anexa** al PDF al aprobar los 3.
- Rechazo con motivo → estado "Rechazada"; reenvío = nueva ronda (todos a pendiente).
- **Timeline legible** para todos; audit técnico solo admin.
- Recordatorio **manual** (botón admin).
- **Override de admin** con atribución transparente ("en representación de").
- **Móvil**: solo el flujo de aprobación es responsive.

**Fuera de scope (explícito):**
- Aprobación de presupuestos/cotizaciones (el modelo queda listo, pero la UI no).
- Recordatorios automáticos (cron / pg_cron).
- Delegación temporal entre usuarios.
- Versionado formal v1/v2 de documentos.
- Visibilidad scoped por proyecto para externos (se decidió: todos ven todo).
- Realtime/websockets para el badge (se actualiza al navegar/refrescar).
- Overhaul responsive del resto de la app (presupuesto/flujo siguen desktop-first).
- Verificación de dominio DNS de Resend (sigue en modo `onboarding@resend.dev`).

---

## 2. Decisiones (grill-me) — las 15 dimensiones

| # | Tema | Decisión |
|---|------|----------|
| 1 | Roles | **admin** (Alfonso, Jess; operadores, pueden aprobar manual) + **aprobador** (José, Marcos, Edy; ven todo, aprueban/rechazan lo asignado). Sin rol "lector". |
| 2 | Invitación/auth | Pantalla admin **Usuarios** + **magic link** (passwordless, sesiones largas). Invitación vía Supabase Admin API. `profiles` guarda rol + `firmante_id`. |
| 3 | Qué documentos | **Solo Carátulas** en Fase 1, con tabla genérica (`document_type`/`document_id`) lista para presupuestos/cotizaciones. |
| 4 | Aprobadores de carátula | Los **3 firmantes del proyecto** (`project_firmantes`). **Aprobación parcial visible** ("1 de 3"). "Aprobada" solo cuando los 3 aprueban; "Rechazada" si alguno rechaza. Se gestiona en Configuración (firmantes). |
| 5 | Mecanismo de firma | **Ambos**: botón "Aprobar"/"Rechazar" (principal) + **canvas de firma opcional**. La constancia embebe la firma dibujada si existe; si no, el sello tipográfico. |
| 6 | RLS por rol | **RLS hace cumplir los roles** (defense in depth): admin = CRUD completo; aprobador = SELECT en operativo + UPDATE solo de su propio voto. Helper `SECURITY DEFINER` para leer el rol sin recursión. |
| 7 | Triggers de notificación | **Email solo accionable**: (A) nueva carátula → aprobadores; (C) rechazo → admin; (D) aprobación completa → admin. **Badge in-app**: todos los eventos, incluido el progreso parcial. |
| 8 | UI bandeja vs badge | **Bandeja global** `/aprobaciones` (cross-project) + **badge** "pendientes para mí" + **estado inline** ("1 de 3" + chips) en la pestaña Carátula. |
| 9 | Constancia PDF | **Página anexa** al PDF de la carátula, generada al aprobar los 3. Documento autocontenido en Storage; adjunto al email de aprobación completa. (Sin dependencia nueva.) |
| 10 | Rechazo | Estado "Rechazada" + motivo; documento NO se borra. Reenvío = **nueva ronda**, los 3 firmantes vuelven a pendiente. Audit conserva cada ronda. |
| 11 | Audit visibilidad | **Timeline legible** (enviada, cada firma con fecha/hora/IP, rechazo con motivo, reenvíos) visible para **todos**. **audit_log técnico crudo** = solo admin. |
| 12 | Externos | **Todos ven todo** (incl. Marcos/GFA). RLS simple, sin scoping por proyecto. |
| 13 | Móvil | **Solo el flujo de aprobación** es mobile-friendly (bandeja, preview, modal, canvas). Admin desktop-first. |
| 14 | Recordatorios | **Botón manual "Recordar"** (admin) que reenvía el email a pendientes. Sin cron. |
| 15 | Escalación | **Override de admin** con **atribución transparente** ("Marcado como aprobado por [Admin] en representación de [Firmante]"). Sin delegación. |

---

## 3. Modelo de datos (migrations)

Cuatro migraciones nuevas (vía `supabase migration new` + `db push` al remoto, como días
previos). Todas las tablas siguen las convenciones del proyecto (`id uuid` PK,
`created_at`, FKs, soft-delete donde aplica, trigger de audit).

### 3.1 `profiles` — usuarios de la plataforma + rol

```sql
CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  nombre        text        NOT NULL,
  role          text        NOT NULL DEFAULT 'aprobador' CHECK (role IN ('admin','aprobador')),
  firmante_id   uuid        REFERENCES public.firmantes(id),  -- aprobador ↔ su firmante
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```
- `firmante_id`: para aprobadores, apunta a su fila en `firmantes` (José/Marcos/Edy). Para
  admins, `null` (no son firmantes; aprueban por override).
- **Backfill admins** (en la misma migración): inserta perfil `role='admin'` para los
  `auth.users` existentes que correspondan a Alfonso y Jess (match por email). ⚠️ Necesito el
  **email de Jess** (ver §13). El email de Alfonso lo tengo: `alfonsoison@gmail.com`.
- `email`/`nombre` aquí son los del **usuario de la plataforma** (la cuenta auth), distintos
  del `firmantes.email` placeholder del seed de Día 5 (que no se usa para enviar).
- Triggers: `updated_at` + audit.

### 3.2 `approval_requests` — una solicitud por documento por ronda

```sql
CREATE TABLE public.approval_requests (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type        text        NOT NULL CHECK (document_type IN ('caratula')),
  document_id          uuid        NOT NULL,            -- = estimaciones.id (carátula)
  project_id           uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  round                int         NOT NULL DEFAULT 1,
  status               text        NOT NULL DEFAULT 'en_aprobacion'
                         CHECK (status IN ('en_aprobacion','aprobada','rechazada','cancelada')),
  requested_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at          timestamptz,
  constancia_pdf_path  text,                            -- PDF con constancia anexa (al aprobar)
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX approval_requests_doc_round_uidx
  ON public.approval_requests (document_type, document_id, round);
CREATE INDEX approval_requests_open_idx
  ON public.approval_requests (project_id, status);
```
- Genérico por `document_type` + `document_id`: hoy `'caratula'` (document_id = estimación);
  mañana se añade `'presupuesto'`/`'cotizacion'` al CHECK sin re-migración estructural.
- `status` a nivel documento (la fuente de verdad para la bandeja y el inline).
- Triggers: `updated_at` + audit.

### 3.3 `approvals` — un voto/firma por firmante por solicitud

```sql
CREATE TABLE public.approvals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid        NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  firmante_id  uuid        NOT NULL REFERENCES public.firmantes(id),
  status       text        NOT NULL DEFAULT 'pendiente'
                 CHECK (status IN ('pendiente','aprobada','rechazada')),
  decided_at   timestamptz,
  decided_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,  -- quién hizo clic
  on_behalf    boolean     NOT NULL DEFAULT false,   -- admin aprobó en representación
  motivo       text,                                  -- requerido si rechazada
  firma_path   text,                                  -- canvas opcional (bucket 'firmas')
  ip           text,                                  -- IP al decidir (para la constancia)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX approvals_request_firmante_uidx
  ON public.approvals (request_id, firmante_id);
CREATE INDEX approvals_firmante_status_idx
  ON public.approvals (firmante_id, status);
```
- Al "Enviar a aprobación" se crea 1 `approval_requests` + N `approvals` (uno por firmante
  del proyecto, status `pendiente`).
- `decided_by` = el usuario que hizo clic; si `on_behalf=true`, es un admin actuando por el
  firmante (la constancia lo dice explícitamente, decisión #15).
- **Estado del documento (derivado, lo escribe el server action transaccional):** si algún
  voto `rechazada` → request `rechazada`; si todos `aprobada` → request `aprobada`
  (+ `resolved_at`, dispara constancia); si no → `en_aprobacion`.
- Triggers: `updated_at` + audit.

### 3.4 `notifications` — feed in-app + badge

```sql
CREATE TABLE public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- destinatario
  type        text        NOT NULL,   -- nueva_aprobacion | progreso | aprobada | rechazada | recordatorio
  title       text        NOT NULL,
  body        text,
  link        text,                    -- p.ej. /aprobaciones o /proyectos/x/caratula?est=...
  request_id  uuid        REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, read_at);
CREATE INDEX notifications_user_recent_idx ON public.notifications (user_id, created_at DESC);
```
- **Badge** = `count(*) WHERE user_id = auth.uid() AND read_at IS NULL`.
- Inserción cross-user (un admin notifica a aprobadores; un aprobador notifica al admin) vía
  función `SECURITY DEFINER` `public.fn_create_notification(...)` para no abrir un INSERT
  permisivo en RLS.

---

## 4. RLS por rol (decisión #6) — el cambio más delicado

### 4.1 Helpers `SECURITY DEFINER` (evitan recursión de RLS al leer `profiles`)

```sql
CREATE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE auth_user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL);
$$;

CREATE FUNCTION public.my_firmante_id() RETURNS uuid
  LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT firmante_id FROM public.profiles
  WHERE auth_user_id = auth.uid() AND deleted_at IS NULL;
$$;
```

### 4.2 Tablas operativas — endurecer (migración separada y revisable)

Hoy cada tabla operativa tiene `auth_full_* FOR ALL TO authenticated USING(true) WITH
CHECK(true)`. Se **reemplaza** por: SELECT abierto a todo autenticado + escritura solo admin.

Para `projects, firmantes, project_firmantes, pagadores, contratistas, partidas,
estimaciones`:
```sql
DROP POLICY auth_full_<tabla> ON public.<tabla>;
CREATE POLICY <tabla>_select TO authenticated FOR SELECT USING (true);
CREATE POLICY <tabla>_insert TO authenticated FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY <tabla>_update TO authenticated FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY <tabla>_delete TO authenticated FOR DELETE USING (public.is_admin());
```
→ admin conserva CRUD completo (no nota cambio); aprobador queda **solo lectura**.

> ⚠️ **Regresión clave:** mientras NO existan perfiles, `is_admin()` devolvería `false` y
> Alfonso/Jess perderían escritura. Por eso la migración 8a-1 (profiles + backfill admins) va
> **antes** y en el **mismo push** que la 8a-2 (endurecer RLS). Validación dedicada (§12).

### 4.3 RLS de las tablas nuevas

- **profiles**: `SELECT` propio (`auth_user_id = auth.uid()`) **o** `is_admin()`;
  `INSERT/UPDATE/DELETE` solo `is_admin()`.
- **approval_requests**: `SELECT` todo autenticado (timeline visible a todos, #11);
  `INSERT/UPDATE` solo `is_admin()` (admin envía, cancela, adjunta constancia).
- **approvals**: `SELECT` todo autenticado; `INSERT` solo `is_admin()` (se crean al enviar);
  `UPDATE` `USING (is_admin() OR firmante_id = my_firmante_id())` — el aprobador solo edita su
  propia fila; el field-level (solo status/motivo/firma/ip) lo garantiza el server action.
- **notifications**: `SELECT`/`UPDATE` solo propias (`user_id = auth.uid()`, para marcar
  leído); INSERT vía `fn_create_notification` (`SECURITY DEFINER`).
- **audit_log**: hoy es SELECT para todo autenticado. Se **restringe a admin**
  (`USING (is_admin())`) — decisión #11 (el crudo técnico solo admin). El timeline legible NO
  usa `audit_log`: se deriva de `approval_requests` + `approvals`.

---

## 5. Auth / invitación (decisión #2)

### 5.1 Cliente admin (service role) — NUEVO, uso acotado
`src/lib/supabase/admin.ts`: cliente con `SUPABASE_SERVICE_ROLE_KEY` usado **solo** para la
**Admin API de Auth** (`auth.admin.inviteUserByEmail` / `generateLink`). No toca tablas (el
service_role no tiene grants; no los necesita para la Admin API).

### 5.2 Flujo de invitación (`/usuarios`, admin-only)
1. Admin abre **Usuarios** → form: email, nombre, rol (admin/aprobador), y si es aprobador,
   **firmante** (dropdown de `firmantes`).
2. `inviteUser(...)`:
   - (service role) `auth.admin.inviteUserByEmail(email)` → crea `auth.users` + manda magic
     link. Devuelve el `user.id`.
   - (sesión admin autenticada) inserta `profiles {auth_user_id, email, nombre, role,
     firmante_id}` (RLS permite porque `is_admin()`).
3. El invitado hace clic en el link → sesión activa → aterriza en `/aprobaciones`.

### 5.3 Login con magic link
La pantalla `/login` gana opción **"Entrar con enlace mágico"** (input email →
`signInWithOtp`). Se **conserva** el login email+password actual (no se rompe nada).
Sesiones largas (config de Supabase Auth; refresh token de vida larga).

---

## 6. Flujos (ciclo de vida)

### 6.1 Enviar a aprobación (admin) — NUEVO, distinto de "Enviar al contratista"
En la pestaña Carátula, tras **Generar** el PDF, aparece **"Enviar a aprobación"**:
1. `enviarAAprobacion(estimacionId, projectId)`:
   - Lee los firmantes del proyecto (`project_firmantes` → `firmantes` activos).
   - Crea `approval_requests {document_type:'caratula', document_id:est.id, project_id,
     round: maxRound+1, status:'en_aprobacion', requested_by}` + N `approvals` pendientes.
   - `fn_create_notification` para cada firmante (tipo `nueva_aprobacion`) + **email**
     accionable (Resend) a cada aprobador.
2. La estimación NO cambia su `status` de pago (pendiente/enviada/pagada es ortogonal a la
   aprobación; ver §6.5).

### 6.2 Aprobar / rechazar (aprobador o admin)
Desde la bandeja **o** el inline en Carátula → modal con preview del PDF + botones:
- **Aprobar**: `aprobar(approvalId, { firmaDataUrl? })` → si hay canvas, sube la imagen a
  `firmas/` y guarda `firma_path`; set voto `aprobada`, `decided_at`, `decided_by`, `ip`.
- **Rechazar**: `rechazar(approvalId, { motivo })` → `motivo` requerido (Zod); set
  `rechazada`. Marca el request `rechazada` + `resolved_at`; **email** al admin (#7 C) +
  notif.
- **Recalcular** request: si todos `aprobada` → request `aprobada` → dispara constancia (§7)
  + **email** de aprobación completa al admin (#7 D, con PDF adjunto) + notif. Cada voto
  individual → notif de **progreso** (sin email).

### 6.3 Override de admin (decisión #15)
En cualquier voto pendiente, el admin ve "Aprobar/Rechazar en representación". Set
`on_behalf=true`, `decided_by=adminUserId`. La constancia y el timeline lo dicen:
**"Marcado como aprobado por [Admin] en representación de [Firmante]"** — nunca como si el
firmante hubiera firmado.

### 6.4 Rechazo y reenvío (decisión #10)
Tras un rechazo, el admin corrige (edita la estimación en Flujo, etc.) y vuelve a
**"Enviar a aprobación"** → nueva `approval_requests` con `round = maxRound+1` y N votos
**pendientes** (los 3 reinician). El request anterior queda `rechazada` en el historial. El
timeline muestra todas las rondas.

### 6.5 Recordar (decisión #14)
En la bandeja/detalle, botón admin **"Recordar"** → reenvía el email accionable a los
firmantes con voto aún `pendiente` del request abierto. Sin cron.

### 6.6 Relación con el estatus de pago
`estimaciones.status` (pendiente/enviada/pagada) es **independiente** del estado de
aprobación. **Supuesto (§14.1):** la aprobación in-platform es un **paso previo** al envío al
contratista; el botón "Enviar al contratista" (Día 5) se mantiene y, idealmente, se usa una
vez la carátula está **aprobada**. No se bloquea por código en Fase 1 (solo se ordena la UI);
si quieres que "Enviar al contratista" se **deshabilite hasta aprobada**, lo agrego.

---

## 7. Constancia PDF (decisión #9)

- Se **extiende** `<Caratula>` (`caratula-document.tsx`) con una **página final opcional**
  `<ConstanciaPage>` (mismo `Document`, sin dependencia nueva).
- Contenido por firmante: nombre, cargo, empresa, **"Aprobado el dd/mm/yyyy a las HH:MM"**,
  **IP**, y **firma dibujada** si existe (`firma_path` → data URI); si no, sello tipográfico.
  Override → "en representación de" explícito. Pie con sello NAUKA + folio del request.
- Se genera **cuando el request pasa a `aprobada`**: `build-caratula-props` recibe los datos
  de aprobación; se renderiza el PDF (carátula + constancia) a buffer y se sube a
  `proyectos/{project_id}/caratulas/{estimacion_id}_constancia_r{round}.pdf`; el path se
  guarda en `approval_requests.constancia_pdf_path`.
- El **email de aprobación completa** (admin) adjunta ese PDF. La bandeja/Carátula permiten
  descargarlo (signed URL).

---

## 8. Notificaciones + email (decisión #7)

| Evento | In-app (badge/feed) | Email |
|--------|---------------------|-------|
| (A) Enviada a aprobación | sí → a los 3 aprobadores | **sí** → aprobadores |
| (B) Cada voto individual (progreso) | sí → admin (y aprobadores) | no |
| (C) Rechazo (con motivo) | sí → admin | **sí** → admin |
| (D) Aprobación completa (los 3) | sí → admin | **sí** → admin (PDF adjunto) |
| Recordatorio (manual) | — | **sí** → pendientes |

- Plantillas nuevas en `src/lib/email/` (React Email, mismo patrón que `caratula-email.tsx`):
  `nueva-aprobacion-email.tsx`, `aprobacion-rechazada-email.tsx`,
  `aprobacion-completa-email.tsx`. Los correos van a `profiles.email` del destinatario.
- `from` sigue siendo `RESEND_FROM` (modo prueba `onboarding@resend.dev` entrega solo al
  dueño de la cuenta Resend, igual que Día 5 — relevante para probar de punta a punta).

---

## 9. UI / superficies

- **`/aprobaciones`** (nuevo, server) — **bandeja cross-project**. Aprobador: "Lo que debo
  firmar" (sus votos pendientes) + historial. Admin: requests `en_aprobacion` de todos los
  proyectos + acciones (recordar, override). **Mobile-friendly** (#13).
- **Badge** en sidebar + Home: count de notifs no leídas (o votos pendientes para aprobador).
  Se calcula en el server (layout) y se pasa como prop; se revalida tras cada acción. **No**
  realtime.
- **`/usuarios`** (nuevo, admin-only) — lista de `profiles` + form de invitación + cambiar
  rol / desactivar (soft-delete). Item en sidebar **solo si admin**.
- **Pestaña Carátula** (editada) — por estimación: chips de estado por firmante + "1 de 3",
  botón **"Enviar a aprobación"**, **timeline** legible, y, si el viewer es un firmante con
  voto pendiente, botones **Aprobar/Rechazar** (mismo modal que la bandeja).
- **Modal Aprobar/Rechazar** (`approve-reject-dialog.tsx`, client) — preview del PDF +
  Aprobar/Rechazar + **canvas opcional** + motivo (en rechazo). Reusado en bandeja y Carátula.
- **Canvas de firma** (`signature-canvas.tsx`, client) — **hand-rolled** (`<canvas>` +
  pointer events → `toDataURL`), **sin dependencia nueva** (honra stack fijo). Funciona con
  dedo en móvil.

---

## 10. Estructura de archivos

**Nuevos:**
```
supabase/migrations/
  <ts>_add_profiles_and_roles.sql         # profiles + helpers + RLS profiles + backfill admins
  <ts>_tighten_rls_for_roles.sql          # operativo: SELECT(all) + escritura(admin); audit_log→admin
  <ts>_add_approvals.sql                  # approval_requests + approvals + RLS + triggers
  <ts>_add_notifications.sql              # notifications + fn_create_notification + RLS

src/lib/supabase/admin.ts                 # cliente service-role (solo Admin API de Auth)
src/lib/auth/roles.ts                     # getMyProfile(), requireAdmin(), isAdmin() (server)
src/lib/approvals/compute.ts              # puro: deriveRequestStatus(votes), helpers de estado
src/lib/email/
  nueva-aprobacion-email.tsx
  aprobacion-rechazada-email.tsx
  aprobacion-completa-email.tsx

src/components/approvals/
  approval-status-chips.tsx               # "1 de 3" + chips por firmante (server-friendly)
  approval-timeline.tsx                   # timeline legible (todos)
  approve-reject-dialog.tsx               # "use client" — preview + aprobar/rechazar + canvas + motivo
  signature-canvas.tsx                    # "use client" — canvas hand-rolled → dataURL
  notifications-badge.tsx                 # badge (count por prop) + dropdown del feed

src/components/caratula/constancia-page.tsx  # <ConstanciaPage> anexa al Document

src/app/aprobaciones/page.tsx             # bandeja (server)
src/app/aprobaciones/actions.ts           # aprobar(), rechazar(), recordar(), marcarLeida()
src/app/usuarios/page.tsx                 # admin-only
src/app/usuarios/actions.ts               # inviteUser(), updateUserRole(), deactivateUser()
src/app/usuarios/usuarios-client.tsx      # lista + form invitación
```

**Editados (quirúrgico):**
```
src/app/proyectos/[id]/caratula/page.tsx              # + fetch estado de aprobación por estimación
src/app/proyectos/[id]/caratula/actions.ts            # + enviarAAprobacion(); + constancia al aprobar
src/app/proyectos/[id]/caratula/build-caratula-props.ts # + datos de aprobación (constancia, opcional)
src/app/proyectos/[id]/caratula/caratula-client.tsx   # + botón enviar + inline status/timeline + aprobar/rechazar
src/components/caratula/caratula-document.tsx         # + <ConstanciaPage> opcional
src/components/sidebar.tsx                            # + item "Aprobaciones" (badge) + "Usuarios" (si admin)
src/app/page.tsx (Home)                               # + acceso/badge a Aprobaciones
src/app/login/...                                     # + opción magic link (conserva password)
src/lib/env-server.ts                                 # + SUPABASE_SERVICE_ROLE_KEY
src/app/proyectos/[id]/layout.tsx (o donde viva)      # fetch rol + pendingCount para sidebar/badge
```

- `<Caratula>`/`<ConstanciaPage>` siguen siendo **props-driven** (no conocen Supabase),
  fieles a la nota de Día 5 sobre encapsular el componente.
- No se mueve `formatMXN` ni se tocan helpers existentes salvo extensión aditiva.

---

## 11. Plan de implementación por sub-fases (cada una = 1 PR revisable)

> Te entrego y verificas **una sub-fase a la vez**; commiteo solo con tu OK, igual que el
> resto del proyecto.

- **8a — Fundaciones multi-usuario.** profiles + helpers + backfill admins + endurecer RLS +
  magic link en login + pantalla **Usuarios** (invitar). *Resultado:* José/Marcos/Edy/Jess
  entran; aprobador es solo-lectura; admin sigue con CRUD. (Aún sin aprobaciones.)
- **8b — Núcleo de aprobaciones.** approval_requests/approvals + RLS + "Enviar a aprobación" +
  **bandeja** + Aprobar/Rechazar (**solo botón**) + estado inline + timeline + derivación de
  estado + override admin + reenvío por ronda. *Resultado:* loop completo end-to-end.
- **8c — Constancia PDF.** `<ConstanciaPage>` anexa + generación al aprobar + storage +
  descarga.
- **8d — Notificaciones + email.** notifications + badge + feed + 3 plantillas Resend +
  "Recordar".
- **8e — Canvas + móvil.** firma canvas hand-rolled + responsive de bandeja/preview/modal.

Cada sub-fase: `biome` + `tsc` + `build` en verde + checklist de regresión (§12) antes de
pedirte verificación.

---

## 12. Validación + regresión (por sub-fase)

1. `pnpm dlx @biomejs/biome check .`, `pnpm tsc --noEmit`, `pnpm build` (3 verde).
2. Migraciones aplicadas al remoto sin error.
3. **Regresión RLS (crítica, 8a):** tras backfill + endurecer, verificar que **Alfonso y Jess
   siguen pudiendo** crear/editar contratistas, partidas, estimaciones, carátulas, config
   (son admin). Verificar que un **aprobador NO puede** escribir (intento de UPDATE devuelve
   error de RLS) pero **sí lee** todo.
4. **Regresión de superficies existentes:** Flujo de Pagos (CRUD, IVA, comprobante, sticky
   actions), Carátula (generar/enviar al contratista), Resumen, Resumen Mensual,
   Configuración (pagadores, logo, firmantes, default_emails), Home — **intactas** para admin.
5. **Flujo feliz (8b+):** enviar a aprobación → 3 aprueban → request `aprobada` → (8c)
   constancia generada → (8d) emails + badge correctos. Rechazo → motivo → reenvío → nueva
   ronda (3 pendientes). Override admin → atribución correcta en constancia/timeline.
6. **Login:** magic link entra; email+password **sigue** funcionando.

---

## 13. Variables de entorno (lo que necesito de ti)

Agregar a `.env.local` (y a Vercel):
```
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # Supabase → Project Settings → API → service_role (secreto)
```
- Necesario **solo** para la Admin API de Auth (invitar usuarios). Nunca se expone al cliente
  (server-only, `src/lib/env-server.ts`).
- `RESEND_API_KEY` / `RESEND_FROM` ya existen (Día 5).

**Dato que necesito (no es env):** el **email de la cuenta de Jess** para el backfill de
admin (Alfonso ya lo tengo). Si su cuenta auth aún no existe, la creas tú primero por la
pantalla Usuarios (rol admin) en 8a, y omito a Jess del backfill.

---

## 14. Supuestos a confirmar (puedes vetar en la revisión)

1. **Aprobación = paso previo al envío al contratista**, pero **NO se bloquea por código** en
   Fase 1 (solo se ordena la UI). Si quieres que "Enviar al contratista" se **deshabilite
   hasta que la carátula esté aprobada**, dímelo y lo agrego.
2. **Aprobadores = los 3 firmantes del proyecto** (Edy/José/Marcos), gestionados en
   Configuración. Si un firmante no tiene cuenta de usuario aún, su voto queda pendiente hasta
   que entre (o el admin hace override). El **mapeo usuario↔firmante** se elige en el form de
   Usuarios (dropdown de firmantes).
3. **Emails de aprobación van a `profiles.email`** (la cuenta de la plataforma), no al
   `firmantes.email` placeholder del seed de Día 5.
4. **Badge sin realtime**: se actualiza al navegar/refrescar y tras cada acción (no
   websockets). Suficiente para el volumen actual; se puede agregar Realtime después.
5. **Canvas hand-rolled** (sin `react-signature-canvas` ni otra dep), para respetar el stack
   fijo.
6. **`firmantes_seleccionados`** (columna `uuid[]` existente, sin uso) **no se toca**: los
   aprobadores salen de `project_firmantes`, no de una selección por estimación.
7. **audit_log se restringe a admin** (hoy lo lee cualquier autenticado). El timeline legible
   no depende de audit_log (se deriva de approvals). Si algún aprobador necesitara ver el
   audit crudo, se revisa.
8. **Constancia se regenera por ronda** (`_constancia_r{round}.pdf`); los PDFs de rondas
   previas quedan en Storage (convención no-hard-delete del proyecto).
```

