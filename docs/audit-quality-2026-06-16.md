# Auditoría de calidad — NAUKA Pagos

> Auditoría **read-only** · 2026-06-16 · rama `main` @ `87b0406` · contra el código tal cual está en prod (Vercel verde).
> Alcance: 10 dimensiones de calidad + enfoque especial en la sub-fase 8d (aprobaciones, notificaciones, emails). **No se modificó código.** Cada hallazgo se verificó leyendo el archivo real; las citas son `archivo:línea`.

---

## Resumen ejecutivo

La salud general del proyecto es **buena**. La disciplina de ingeniería es alta y verificable: **cero `any`** en todo `src/`, `strict: true`, **cero `console.log`** (solo 4 `console.error` legítimos), **ningún componente cliente importa módulos server-only** (secretos no se filtran al bundle), RLS endurecida por rol en todas las tablas operativas + Storage, la matemática de dinero (IVA, c/IVA) vive en **columnas generadas `numeric(14,2)` con `round(...,2)` en Postgres** (no en floats), triggers de auditoría en todas las tablas financieras, validación Zod en cliente **y** servidor, y fidelidad literal al Excel (6 tabs en orden, columnas del Flujo). **No se encontró ningún hallazgo Crítico** ni error en la matemática financiera. El bug de Selects de base-ui está correctamente resuelto (todos pasan `items=`).

Los riesgos se concentran en la superficie **más nueva y menos probada (8d)** y en integridad transversal. Los **3 riesgos más importantes**:

1. **🟠 Los emails de aprobación a admins (eventos C/Rechazo y D/Aprobación completa) no entregan a NADIE en modo prueba de Resend**, porque envían un solo correo con `to: admins.map(...)` (varios destinatarios). Resend en modo prueba rechaza el envío completo si cualquier destinatario ≠ el dueño de la cuenta — así que ni el admin-dueño lo recibe. Es la causa probable de que "no lleguen correos". Como es best-effort (try/catch), el fallo es silencioso. *(Este es exactamente el hallazgo que pediste confirmar.)*
2. **🟠 Las funciones de notificación (`fn_create_notification`, `fn_notify_admins`) están sobre-expuestas**: con `GRANT EXECUTE … TO authenticated` + `SECURITY DEFINER`, cualquier usuario logueado (incl. los 3 aprobadores) puede, desde el navegador, **inyectar notificaciones con link arbitrario en la bandeja de cualquier usuario** (vector de phishing dentro de la UI confiable) y **cosechar los correos/nombres de los admins** — justo la frontera que la función pretendía proteger.
3. **🟠 Integridad del voto bajo concurrencia**: el `UPDATE` del voto en `decide()` no tiene candado a nivel DB (`status='pendiente'` solo se valida en JS, no en el `WHERE` ni en RLS), así que un doble-clic, una carrera admin-vs-aprobador, o un `UPDATE` directo desde el browser pueden **sobrescribir un voto ya resuelto**. Sumado a la **falta de atomicidad transaccional** en operaciones multi-escritura (p. ej. `enviarAAprobacion` puede dejar una solicitud abierta con 0 votos), es el riesgo de integridad más relevante para un registro de aprobaciones financieras.

Ninguno de estos es bloqueante para el uso actual (5 usuarios conocidos, externos aún no invitados), pero los tres deberían atacarse antes de invitar a José/Marcos/Edy. El resto son hallazgos Medios/Bajos de robustez, performance y mantenibilidad.

**No se reportan como bug las decisiones conscientes documentadas en STATE.md** (lectura cross-project abierta, status de pago manual, IVA por checkbox, M3 = ban vía Admin API, CSP report-only, sin EOM, fecha única `fecha_estimacion`, borrar todas las rondas al soft-delete una estimación, kebab diferido, etc.).

---

## Hallazgos por dimensión

### 1. Correctitud e integridad de datos

**✅ Lo que está bien (verificado):**
- IVA y montos c/IVA son **columnas generadas en la DB**: `iva_monto = round(monto_sin_iva*iva_pct,2)` y `monto_con_iva = round(monto_sin_iva*(1+iva_pct),2)`, ambas `numeric(14,2)` (`supabase/migrations/20260527002141_initial_schema.sql:236-237`). No hay floats en el origen. Además, como `monto_sin_iva` es múltiplo exacto de 0.01, `monto_con_iva ≡ monto_sin_iva + iva_monto` siempre (no hay descuadre de 1 centavo entre las dos columnas).
- Acumulado de carátula: suma de TODAS las estimaciones de la partida con `fecha ≤ esta` incluyéndola, sin importar status, con desempate por `created_at` (`src/app/proyectos/[id]/caratula/build-caratula-props.ts:113-132`). Coincide al pie de la letra con la decisión documentada.
- "Pagado Acum." y "Resto por Pagar" del Flujo: running total por partida solo de `pagada`, en orden fecha ASC, incluyéndose la fila (`src/app/proyectos/[id]/flujo-de-pagos/page.tsx:124-164`). Consistente con `ejercido = pagada` del Resumen (`src/lib/resumen/compute.ts:71-83`).
- Soft-delete (`deleted_at`) filtrado en lecturas; `.is("deleted_at", null)` en todas las queries y en los `UPDATE` de mutación.

**⚪ Bajo — B1 · Agregación de dinero en floating point de JS**
`src/lib/resumen/compute.ts:110-113`, `src/app/proyectos/[id]/flujo-de-pagos/page.tsx:135`, `build-caratula-props.ts:120-126`.
Los totales se acumulan con `Number(...)` + `reduce`/`+=` en JS (binario). *Qué:* sumar muchos `numeric(14,2)` en float no es exacto en teoría. *Por qué importa poco:* para las magnitudes y volúmenes de este dominio (cientos de miles, ≤ miles de filas) el error acumulado (~1e-7) está muy por debajo de medio centavo, y `Intl.NumberFormat` redondea a 2 decimales al mostrar → el total siempre cuadra al centavo (consistente con "L44 cuadra al centavo"). No se encontró ninguna comparación por igualdad exacta de montos. *Recomendación:* dejarlo, o redondear los agregados a centavos en los puntos de frontera (`Math.round(x*100)/100`) por higiene. No urgente.

**⚪ Bajo — B2 · `numeroALetras` se rompe para montos ≥ 1,000 millones**
`src/lib/format/numero-a-letras.ts:90-99`.
*Qué:* `enteroALetras` usa `hundreds(millones)` y `hundreds()` solo soporta 0–999 (`CENTENAS` tiene índices 0–9). Para `millones ≥ 1000` (cantidades ≥ $1,000,000,000) produce `undefined` en el texto. *Por qué importa poco:* irreal para una estimación de obra (la mayor de L44 ronda cientos de miles). *Recomendación:* hacer `enteroALetras` recursivo sobre los grupos de millones, o agregar un guard. Baja prioridad.

---

### 2. Seguridad y RLS

**✅ Lo que está bien (verificado):**
- RLS endurecida por rol en `projects, firmantes, project_firmantes, pagadores, contratistas, partidas, estimaciones`: **SELECT abierto a autenticados; INSERT/UPDATE/DELETE solo `is_admin()`** (`supabase/migrations/20260602023425_tighten_rls_for_roles.sql:23-43`). `is_admin()`/`my_firmante_id()` son `SECURITY DEFINER STABLE` sin recursión (`20260602023424_add_profiles_and_roles.sql:51-82`).
- Storage endurecido igual: lectura abierta, write/delete solo admin en bucket `proyectos`; bucket `firmas` con prefijo por firmante previsto para 8e (`20260609201429_harden_storage_rls.sql`).
- `service_role` se usa **exclusivamente** para la Admin API de Auth (invitar `usuarios/actions.ts:53`, banear `:143`); todos los datos van por el cliente SSR autenticado. `createAdminClient` server-only, devuelve `null` si falta la key (`src/lib/supabase/admin.ts`).
- Secretos server-only: `env-server.ts` con acceso perezoso; **ningún `"use client"` importa `env-server`/`supabase/admin`/`supabase/server`/`SERVICE_ROLE`/`RESEND_API`** (verificado por grep — 0 resultados).
- Validación de uploads tipo + tamaño en cliente y server (`flujo-de-pagos/actions.ts:241-261`). Middleware usa `getUser()` (no `getSession()`) justo tras crear el cliente (`src/lib/supabase/middleware.ts:44-46`).

**🟠 Alto — A2 · `fn_create_notification` y `fn_notify_admins` son invocables por cualquier autenticado (inyección de notificaciones + fuga de PII de admins)**
`supabase/migrations/20260615201623_add_notifications.sql:66` · `supabase/migrations/20260615202834_notify_admins_fn.sql:40` · llamadas en `src/lib/approvals/notify.ts:102,146,174,212`.
*Qué:* ambas funciones son `SECURITY DEFINER` (corren como owner, bypass RLS) y tienen `GRANT EXECUTE … TO authenticated`. Aunque el código solo las llama desde server actions, el GRANT las hace invocables directamente con la anon key + el JWT de cualquier usuario logueado (p. ej. desde la consola del navegador: `supabase.rpc('fn_create_notification', {...})`):
  - `fn_create_notification(p_user_id, p_type, p_title, p_body, p_link, …)` permite **insertar una notificación para CUALQUIER `user_id`** con título/cuerpo/link totalmente controlados por el atacante → un link arbitrario aparece dentro de la bandeja/feed confiable del admin (**vector de phishing**).
  - `fn_notify_admins(...)` **devuelve `email` y `nombre` de todos los admins** al que la llama — justo la información que la RLS de `profiles` (`auth_user_id = auth.uid() OR is_admin()`) niega a los aprobadores. Es la frontera que la función fue creada para preservar, y el GRANT la abre.
*Por qué importa:* es un quiebre de menor-privilegio en el código más nuevo. Hoy el conjunto de usuarios es pequeño y de confianza (y los externos aún no se invitan — ver STATE "BLOQUEANTE antes de invitar externos"), lo que **acota el impacto**, pero el patrón es explotable en cuanto entre el primer aprobador externo. *Recomendación (sin implementar):* (a) no devolver correos al caller —que `fn_notify_admins` inserte y no retorne PII; el envío de email puede resolverse en otra capa server-only— o (b) validar dentro de la función que `p_request_id` corresponde a una solicitud en la que el caller tiene un voto, y derivar `p_type/title/body/link` server-side en vez de aceptarlos del cliente; o (c) si se acepta el modelo de confianza, documentarlo explícitamente como decisión y al menos restringir `p_link` a rutas internas.

**🟠 Alto — A3 · El `UPDATE` de voto no tiene candado de estado a nivel DB (se puede sobrescribir un voto ya resuelto)**
`src/app/aprobaciones/actions.ts:64-88` + RLS `approvals_update` en `supabase/migrations/20260602040155_add_approvals.sql:124-128`.
*Qué:* `decide()` valida `req.status==='en_aprobacion'` y `vote.status==='pendiente'` en JS (líneas 64-69), pero el `UPDATE` solo filtra `.eq("id", approvalId)` (líneas 77-87) — sin `.eq("status","pendiente")` en el `WHERE`. La policy RLS de UPDATE permite a un firmante actualizar **su** voto sin importar su estado actual ni qué columnas toca ("El control de campos lo hace el server action"). *Por qué importa:* es un check-then-act (TOCTOU). Un doble-clic, una carrera entre el voto del aprobador y un "decidir por X" del admin, o un `UPDATE` directo desde el browser (RLS lo permite para el propio `firmante_id`) pueden re-escribir un voto ya emitido (cambiar aprobada↔rechazada, motivo, etc.), corrompiendo la constancia. Contrasta con `marcarEstimacionEnviada`/`eliminarRonda`, que **sí** ponen el estado en el `WHERE`. *Recomendación:* agregar `.eq("status","pendiente")` al `UPDATE` y verificar filas afectadas (devolver "ya resuelto" si 0); idealmente reforzar con un trigger/policy que prohíba transicionar un voto fuera de `pendiente`.

**🟡 Medio — M3 · Varios server actions de escritura no llaman `requireAdmin()` (dependen solo de RLS)**
`src/app/proyectos/[id]/flujo-de-pagos/actions.ts`: `createEstimacion:83`, `updateEstimacion:128`, `deleteEstimacion:209`, `marcarEstimacionEnviada:190`, `uploadComprobante:249` (compárese con `removeComprobante:305` que sí lo hace, y con todo `caratula/actions.ts` y `aprobaciones/actions.ts` que sí).
*Qué:* estas mutaciones no verifican rol en el server action; confían 100% en la RLS (`is_admin()`). *Por qué importa:* **no es un hueco de autorización** —la RLS bloquea efectivamente al aprobador (verificado en `tighten_rls_for_roles`)— pero (1) un no-admin recibe un error crudo de Postgres ("new row violates row-level security policy") en vez de un "No autorizado" limpio, (2) es defensa-en-profundidad ausente y (3) es inconsistente con el resto del código. *Recomendación:* añadir `await requireAdmin()` al inicio de esas 5 acciones, como ya hacen las demás.

---

### 3. Type safety

**✅ Excelente.** `strict: true` (`tsconfig.json:7`), Biome `recommended: true` (incluye `noExplicitAny`). **Cero `any` / `as any` / `<any>` en `src/`** (grep). Los datos crudos de Supabase se tipan localmente (`RawRequest`, `RawVote`, `MontoRow`, etc.) y los montos `unknown` se coercionan con `Number(...)` defensivamente (maneja string|number que devuelve PostgREST para `numeric`). Server actions con tipos de retorno explícitos (`ActionResult`, `DecisionResult`, etc.). No hay hallazgos de severidad aquí.

*Nota menor:* no hay tipos generados de Supabase (`database.types.ts`); las filas se tipan a mano. Es una decisión válida y consistente, pero implica mantener los tipos sincronizados con el esquema manualmente. Sin acción.

---

### 4. Manejo de errores y edge cases

**✅ Lo que está bien:**
- Notif/email best-effort: cada `notify*` envuelve todo en try/catch y solo hace `console.error` — un fallo nunca rompe el voto/solicitud (`src/lib/approvals/notify.ts:84-132,136-156,160-201,205-243`). Verificado.
- `getResend()` devuelve `null` si falta `RESEND_API_KEY`; `enviarCaratula` lo surface con mensaje claro (`caratula/actions.ts:110-116`), y los `notify*` simplemente no mandan email (in-app sigue).
- Estados vacíos presentes ("No hay aprobaciones todavía", shells sin partidas, `formatDate` → "—").
- `enviarCaratula` ordena las escrituras para surface fallos parciales ("Enviado, pero error guardando copia…").

**🟡 Medio — M5 · Los loops de notificación/email comparten un solo try/catch → un fallo aborta el resto del lote**
`src/lib/approvals/notify.ts:101-128` (loop de `fn_create_notification` y loop de envío de email del evento A).
*Qué:* ambos `for` viven dentro del mismo `try`; si la iteración 1 lanza (p. ej. Resend rechaza ese destinatario), el `catch` corta y las iteraciones 2..N nunca se ejecutan. *Por qué importa:* hoy en modo prueba todos los terceros fallan igual, pero **una vez verificado el dominio**, un solo correo problemático (bounce síncrono, dirección inválida) dejaría a los demás firmantes sin notificación/email. *Recomendación:* try/catch por iteración, o `Promise.allSettled` sobre los envíos, registrando los que fallan.

**🟡 Medio — M1 · Falta de atomicidad en operaciones multi-escritura** (ver también dimensión 6)
Ejemplos verificados:
- `enviarAAprobacion` inserta `approval_requests` y luego `approvals` en pasos separados (`caratula/actions.ts:224-247`). Si el segundo falla, queda una **solicitud abierta con 0 votos** (`deriveRequestStatus` la mantiene `en_aprobacion` "0/0" indefinidamente).
- `decide()` actualiza el voto y luego `recomputeRequest` actualiza la solicitud (`aprobaciones/actions.ts:90,122-144`): si lo segundo falla, el voto queda resuelto y la solicitud con estado viejo.
- `deleteEstimacion` (`flujo-de-pagos/actions.ts:214-233`), `deleteCaratula` (`caratula/actions.ts:295-323`) e `inviteUser` (`usuarios/actions.ts:61-83`, auth.user creado pero perfil falla → usuario huérfano que loguea sin acceso) tienen el mismo patrón secuencial sin transacción.
*Por qué importa:* Supabase JS no abre transacciones multi-statement; los fallos parciales dejan estados inconsistentes en datos de aprobación financiera. *Recomendación:* mover las secuencias críticas (sobre todo request+votes) a funciones Postgres (RPC) que corran en una sola transacción. Mitigante actual: varios casos se re-derivan en lectura y el admin ve el error, así que son recuperables manualmente.

---

### 5. Fronteras server/client

**✅ Limpio.** Server Components por defecto; `"use client"` solo en componentes con interacción (53 archivos, todos formularios/diálogos/botones/tablas interactivas). **Ningún cliente importa server-only** (grep dirigido: 0 resultados). Mutaciones por Server Actions (`"use server"`); cero rutas REST salvo los route handlers de auth (`/auth/callback`, `/auth/confirm`) que es lo correcto para magic links. Queries protegidas vía el helper SSR `createClient()` (`@supabase/ssr`). Sin hallazgos.

---

### 6. Esquema de DB y migraciones

**✅ Lo que está bien:** FKs en todas las relaciones reales con `ON DELETE` apropiado (`CASCADE`/`SET NULL`/`RESTRICT`); CHECKs de dominio (status, iva_pct 0–1, round ≥ 1, presupuesto ≥ 0); índices únicos parciales `WHERE deleted_at IS NULL`; `id uuid default gen_random_uuid()` + `created_at` en todas; triggers de auditoría `fn_audit_change` (SECURITY DEFINER) en `projects, firmantes, contratistas, partidas, estimaciones, profiles, approval_requests, approvals` — **incluyendo el before-image en DELETE**, lo que sostiene la "constancia probatoria" al hard-deletear rondas (verificado: el cascade de `approvals` también dispara su trigger). Migraciones aditivas y reversibles (drops idempotentes, `IF EXISTS`); índice único `(document_type, document_id, round)` que **previene rondas abiertas duplicadas** ante carreras de `enviarAAprobacion`.

**🟡 Medio — M2 · `approval_requests.document_id` es polimórfico SIN foreign key (raíz de las rondas huérfanas)**
`supabase/migrations/20260602040155_add_approvals.sql:23,53-54`.
*Qué:* `document_id` referencia `estimaciones.id` pero no tiene FK (modelo genérico de aprobación). *Por qué importa:* la integridad referencial queda en manos de la aplicación. Es la **causa raíz de la clase de bug "rondas huérfanas"** que la sesión 8d tuvo que parchear excluyéndolas en lectura (`fetch.ts:120-134,286-324`) y borrándolas al soft-delete (`flujo-de-pagos/actions.ts:228-233`). El parche cubre el **síntoma** (badge/bandeja) pero la raíz permanece: cualquier nuevo código que consulte `approval_requests` debe acordarse de excluir huérfanas (fácil de olvidar). *Recomendación:* dado el diseño genérico, documentar el invariante y centralizar la exclusión; si en la práctica solo habrá carátulas, evaluar una FK directa a `estimaciones`. CLAUDE.md pide "FKs siempre / sin huérfanos", así que conviene dejar la desviación por escrito.

*Nota (no es bug):* la tabla `notifications` no tiene trigger de auditoría. Es correcto — es un feed efímero, no dato financiero.

---

### 7. Fidelidad al modelo mental del Excel

**✅ Muy buena.** Las **6 tabs en orden y con labels exactos**: Resumen · Presupuesto · Flujo de Pagos · Carátula · Resumen Mensual · Configuración (`src/components/project-sub-nav.tsx:7-14`). Columnas del Flujo (`flujo-de-pagos/flujo-table.tsx:59-74`) respetan el Excel: `#`, `Pagó`, `Contratista`, `Partida`, `# Estimación`, `Monto`, `Presupuesto`, `Pagado Acum.`, `Resto por Pagar`, `Estatus`, `Notas`. Sin nombres inventados ni traducidos.

Las únicas divergencias son **decisiones conscientes documentadas** (no son hallazgos): se quitó `EOM` ("sin EOM"), `Fecha de pago` → `Fecha estimación` (fecha única `fecha_estimacion`), y se agregaron columnas de funcionalidad nueva (`Aprobación`, `Comprobante`).

**⚪ Bajo — B4 · `formatMXN` no antepone el espacio tras el `$` que pide el spec**
`src/lib/utils.ts:8-17`.
*Qué:* CLAUDE.md (sección "Money formatting") especifica el display `"$ 1,234,567.89"` **con espacio tras el `$`**, pero `Intl.NumberFormat('es-MX', {currency:'MXN'})` produce `"$1,234,567.89"` sin espacio. *Por qué importa poco:* cosmético, locale/currency correctos, `tabular-nums` aplicado en tablas. *Recomendación:* si se quiere honrar el spec literal, post-procesar (`.replace('$','$ ')`) o documentar que se acepta el formato nativo de `es-MX`. Trivial.

---

### 8. Estructura y mantenibilidad

**✅ Lo que está bien:** naming consistente (kebab archivos / Pascal componentes / camel variables); lógica de dinero y de aprobaciones aislada en funciones puras reutilizables (`lib/resumen/compute.ts`, `lib/approvals/compute.ts`); sin código muerto evidente; sin `console.log`; sin `TODO/FIXME` reales (el único match es la palabra "TODO" en un comentario en español).

**⚪ Bajo — B3 · Duplicación puntual de helpers**
- `safeFileName` definido idéntico dos veces: `src/lib/approvals/notify.ts:61` y `src/app/proyectos/[id]/caratula/actions.ts:23`.
- `formatDate` reimplementado localmente en `src/app/proyectos/[id]/flujo-de-pagos/flujo-table.tsx:22` (sin locale `es`) mientras existe el canónico `src/lib/format/fecha.ts:8`.
*Recomendación:* extraer `safeFileName` a `lib/format` y usar el `formatDate` compartido. Riesgo de drift bajo.

**⚪ Bajo — B6 · Componentes/funciones por encima del límite de 80 líneas (CLAUDE.md)**
Ejemplos: `AprobacionesPage` ~142 líneas (`src/app/aprobaciones/page.tsx:48-190`), `EstimacionFormFields` ~290 líneas de cuerpo (`estimacion-form.tsx:126-438`), `estimacion-form.tsx` 438 líneas totales. *Por qué importa poco:* son páginas/forms dominados por JSX; legibles. *Recomendación:* si se retoman, extraer sub-secciones (cards, secciones del form). No urgente.

---

### 9. Performance

**🟡 Medio — M4 · Bandeja de aprobaciones: over-fetch + N+1 de signed URLs**
`src/app/aprobaciones/page.tsx:73` y `:415-423`.
*Qué:* (1) `fetchCaratulaRequests(sb)` se llama **sin** `documentIds`, trayendo TODAS las solicitudes de TODOS los proyectos (+ sus votos + contexto), y luego el filtro por proyecto se aplica en JS (`:109-111`). (2) Dentro de `loadCaratulaContext`, el `for` genera un `createSignedUrl` **secuencial por cada** carátula con PDF (`:419-423`), de forma **eager** (aunque el preview solo se ve al hacer clic). *Por qué importa:* hoy con 1 proyecto con datos es trivial; al llenarse los 3 proyectos, la bandeja hará N round-trips de firma secuenciales y cargará todo para descartarlo. *Recomendación:* empujar el filtro de proyecto al query (`fetchCaratulaRequests` ya acepta acotación; agregar `project_id`); usar la API batch `createSignedUrls(paths, ttl)` o firmar el preview perezosamente al abrir el modal.

**⚪ Bajo — B-perf · `recomputeRequest` abre un segundo cliente Supabase**
`src/app/aprobaciones/actions.ts:122-125` crea otro `await createClient()` en vez de reusar el `sb` del caller. Trivial (lee cookies de nuevo). Sin impacto real; mencionado por completitud.

*✅ Nota positiva:* el resto de las páginas batch-ean bien con `.in(...)` y mapas (Flujo, contexto de carátula), sin N+1 de queries de tabla. Índices presentes para los filtros del Flujo (`estimaciones_partida_idx`, `_status_idx`, `_fecha_estimacion_idx`).

---

### 10. Robustez de UX

**✅ Lo que está bien:** Zod en **cliente** (`estimacion-form.tsx:21` `formSchema` + react-hook-form/Controller) **y servidor** (`actions.ts` `estimacionSchema`); errores inline bajo el campo (sin toasts de validación); dinero con `formatMXN` (es-MX) + `tabular-nums` en tablas y cards; fechas `dd/MM/yyyy` con locale `es` (`lib/format/fecha.ts`); **el bug de Selects de base-ui está resuelto** — todos los `<Select>` pasan la prop `items` value→label (`estimacion-form.tsx:171-174,215-218,251,299-303`); responsive presente; `aria-label` en navegación; `disponible < 0` se pinta en rojo. Sin `dangerouslySetInnerHTML` (los templates de email escapan interpolaciones vía JSX de React Email — sin XSS).

**⚪ Bajo — B8 · Las opciones de cada `<Select>` se declaran dos veces**
Patrón inherente a este wrapper de base-ui: `items={...}` (para el trigger) **y** `<SelectItem>` hijos (para el dropdown), p. ej. `estimacion-form.tsx:171-185`. Pueden desincronizarse si se edita una lista y no la otra. *Recomendación:* considerar un `<SelectItems options={...}/>` que renderice ambos desde una sola fuente. Muy baja prioridad.

---

## El hallazgo de email (detalle del enfoque especial)

**🟠 Alto — A1 · Eventos C (Rechazo) y D (Aprobación completa) no entregan email en modo prueba de Resend, ni siquiera al admin-dueño de la cuenta**
`src/lib/approvals/notify.ts:192-197` (C) y `:233-239` (D); `from` por defecto `onboarding@resend.dev` en `src/lib/env-server.ts:10,20`.

*Qué:* ambos eventos arman **un solo** `resend.emails.send({ to: admins.map(a => a.email), … })` — un correo con varios destinatarios (los 2 admins, Alfonso + Jess). En modo prueba de Resend (sin dominio verificado, usando el remitente compartido `onboarding@resend.dev` que es el default del código), Resend **solo permite enviar al correo dueño de la cuenta** y **rechaza el envío completo (403) si el array `to` incluye cualquier dirección distinta**. Como `[alfonso, jess]` contiene una dirección no-dueña, el correo **falla entero** → ni siquiera el admin-dueño lo recibe. Y como `notify*` es best-effort (try/catch → `console.error`), el fallo es **silencioso**.

Contrasta con el evento A (`:116-128`), que hace **loop por destinatario** (`to: [r.email]`): estructuralmente mejor, aunque sus destinatarios son aprobadores (terceros), así que en modo prueba igual no entregan — eso es la **limitación documentada** ("Resend modo prueba solo entrega al dueño"), no un bug nuevo. El bug específico es que C/D, dirigidos a admins (donde el dueño SÍ debería recibir), se auto-sabotean por el `to` multi-destinatario.

*A confirmar:* asumo que `RESEND_FROM` no está configurado en Vercel (sigue el default test) — STATE confirma "Resend en modo prueba". Verificable en el dashboard de Resend (logs de envíos con 403 "You can only send testing emails to your own email address").

*Recomendación (sin implementar):*
1. **Fix inmediato y barato:** mandar C/D en **loop por destinatario** (igual que A), un `send` por admin. Así, en modo prueba, el correo al admin-dueño **sí** entra (los demás fallan aislados y silenciosos, que es el comportamiento esperado hoy).
2. **Fix de raíz (ya en el roadmap, fuera de scope):** verificar el dominio `izarquitectos.mx` y setear `RESEND_FROM=caratulas@izarquitectos.mx`; entonces todos los destinatarios entregan y el punto 1 deja de importar.
3. Combinar con M5 (try/catch por iteración) para que un destinatario problemático no tumbe al resto.

---

## Tabla priorizada de hallazgos

| ID | Sev | Dim | Hallazgo | Ubicación |
|----|-----|-----|----------|-----------|
| **A1** | 🟠 Alto | 4/8d | Email C/D no entrega en modo prueba (`to:` multi-destinatario → Resend rechaza el envío entero) — causa de "no llegan correos" | `lib/approvals/notify.ts:194,235` |
| **A2** | 🟠 Alto | 2/8d | `fn_create_notification`/`fn_notify_admins` con `GRANT EXECUTE TO authenticated` + `SECURITY DEFINER`: inyección de notificaciones con link arbitrario + fuga de correos de admins | `migrations/…add_notifications.sql:66`, `…notify_admins_fn.sql:40` |
| **A3** | 🟠 Alto | 2/8d | `UPDATE` de voto sin candado de estado en DB/RLS → un voto resuelto se puede sobrescribir (race/doble-clic/cliente directo) | `aprobaciones/actions.ts:77-87`; `…add_approvals.sql:124-128` |
| **M1** | 🟡 Medio | 4/6 | Sin atomicidad transaccional en multi-escrituras (p. ej. `enviarAAprobacion` → solicitud abierta con 0 votos) | `caratula/actions.ts:224-247`; `aprobaciones/actions.ts:90,122-144` |
| **M2** | 🟡 Medio | 6/8d | `approval_requests.document_id` polimórfico sin FK → raíz de las rondas huérfanas | `…add_approvals.sql:23` |
| **M3** | 🟡 Medio | 2/5 | 5 server actions de escritura sin `requireAdmin()` (solo RLS de respaldo; error crudo + inconsistencia) | `flujo-de-pagos/actions.ts:83,128,190,209,249` |
| **M4** | 🟡 Medio | 9 | Bandeja: over-fetch de todos los proyectos + N+1 secuencial de signed URLs (eager) | `aprobaciones/page.tsx:73,415-423` |
| **M5** | 🟡 Medio | 4/8d | Loops de notif/email comparten un try/catch → un fallo aborta el resto del lote | `lib/approvals/notify.ts:101-128` |
| **B1** | ⚪ Bajo | 1 | Agregación de dinero en floats de JS (hoy cuadra al centavo; teórico) | `resumen/compute.ts:110-113`; `flujo…/page.tsx:135` |
| **B2** | ⚪ Bajo | 1 | `numeroALetras` se rompe para montos ≥ $1,000 millones (irreal) | `lib/format/numero-a-letras.ts:90-99` |
| **B3** | ⚪ Bajo | 8 | Duplicación de `safeFileName` (x2) y `formatDate` local en flujo-table | `notify.ts:61`+`caratula/actions.ts:23`; `flujo-table.tsx:22` |
| **B4** | ⚪ Bajo | 7/10 | `formatMXN` sin el espacio tras `$` que pide el spec | `lib/utils.ts:8-17` |
| **B5** | ⚪ Bajo | 8 | Drift de docs: CLAUDE.md dice Next 15 pero `package.json` es next 16.2.6 | `CLAUDE.md:24` / `package.json` |
| **B6** | ⚪ Bajo | 8 | Componentes/funciones > 80 líneas (regla CLAUDE.md) | `aprobaciones/page.tsx:48`; `estimacion-form.tsx:126` |
| **B7** | ⚪ Bajo | 4 | `setUserActive` soft-deletea antes de banear; si el ban falla, el JWT vive hasta expirar (se surface como error) | `usuarios/actions.ts:148-164` |
| **B8** | ⚪ Bajo | 10 | Opciones de cada `<Select>` declaradas dos veces (`items` + hijos) → riesgo de drift | `estimacion-form.tsx:171-185` |
| **B-perf** | ⚪ Bajo | 9 | `recomputeRequest` abre un segundo cliente Supabase en vez de reusar | `aprobaciones/actions.ts:122-125` |

**Conteo:** 0 🔴 · 3 🟠 · 5 🟡 · 9 ⚪.

**Orden sugerido de ataque:** A1 (fix barato de loop, alto valor) → A3 (candado en WHERE, una línea) → A2 (decisión de diseño: gate o documentar) → M1/M2 (RPC transaccional + invariante de huérfanas) → M3/M4/M5 → Bajos cuando se toque el área.

---

*Auditoría read-only. No se modificó código de la app. Las decisiones conscientes de STATE.md ("Decisiones que NO hay que re-grilear") se respetaron y no se reportan como bugs.*
