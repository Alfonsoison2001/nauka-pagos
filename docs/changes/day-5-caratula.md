# Change Proposal — Día 5: Carátula PDF + Envío (Resend) + Firmantes editables

> Estado: **PENDIENTE DE APROBACIÓN**. No se implementa hasta que Alfonso apruebe.
> Fecha: 2026-05-29

---

## 1. Objetivo

Construir la pestaña **Carátula**: seleccionar una estimación ya capturada en Flujo de
Pagos, **generar** su carátula como PDF (`@react-pdf/renderer`), previsualizarla, y
**enviarla** por correo (Resend) con el PDF adjunto. Además, hacer **editables** los
firmantes que aparecen en el bloque de autorizaciones, desde Configuración.

Fuera de scope hoy (explícito): subir "carátula firmada" de regreso, multi-select de
firmantes por estimación, subir imágenes de firma (`firma_url`), reordenar firmantes,
verificar dominio DNS de Resend.

---

## 2. Decisiones (resueltas en grill-me)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Trigger | Tab Carátula = **selector de estimación existente** (creada en Flujo). Una sola fuente de verdad. |
| 2 | Firmantes | **CRUD editable** en Configuración + **seed** inicial. (ajustado vs. solo-seed) |
| 3 | Alcance firmantes | Mismos 3 firmantes vinculados a los 3 proyectos. |
| 4 | Flujo | **Generar** (preview) y **Enviar** como pasos separados. |
| 5 | ACUMULADO | Todas las estimaciones de la partida con `fecha_solicitud ≤` esta (incluyéndola), sin importar status. |
| 6 | Destinatarios | Dialog editable, prellenado con `default_emails` + email del contratista. |
| 7 | Resend | API key sí, dominio no → `from = onboarding@resend.dev` vía `RESEND_FROM`. Modo prueba: solo manda al correo dueño de la cuenta Resend. |
| 8 | Cantidad con letra | Sí: helper `numeroALetras` + mostrarla. |
| 9 | Formato letra | `(SON: … PESOS XX/100 M.N.)`, mayúsculas, bajo TOTAL ESTIMACION. |
| 10 | Layout tab | Dropdown + panel de detalle + preview embebido (iframe). |
| 11 | Saldo header | Header "Saldo por Ejercer" = ANTES de esta (disponible); tabla "POR EJERCER" = después. |

---

## 3. Cambios de base de datos (migrations)

### 3.1 `ALTER TABLE estimaciones ADD COLUMN caratula_pdf_path text`
Guarda el path en Storage de la **copia enviada** del PDF (distinto de
`caratula_generada_url`, que es el preview mutable). Ver §6.

### 3.2 Seed de firmantes (idempotente)
Inserta 3 firmantes globales + sus vínculos a los 3 proyectos (orden 1-3):

| orden | nombre | cargo | empresa | email (placeholder ⚠️) |
|-------|--------|-------|---------|------------------------|
| 1 | Ing. Edy C. Rodríguez | Director De Construcción | IZ Arquitectos | `edy.rodriguez@izarquitectos.mx` |
| 2 | Arq. José Ison | Director General | IZ Arquitectos | `jose.ison@izarquitectos.mx` |
| 3 | Ing. Marcos Fasja | Director General | GFA | `marcos.fasja@gfa.mx` |

⚠️ **Los emails son placeholders.** `email` es `NOT NULL` + único, pero el email del
firmante **no** se usa para enviar (los destinatarios salen del dialog, decisión 6) ni
aparece en el PDF (el Excel solo muestra nombre/cargo/empresa). Corriges los emails reales
después por la UI. Si prefieres otros placeholders, dímelo.

Idempotencia: `WHERE NOT EXISTS` por `lower(email)` en firmantes y por
`(project_id, firmante_id)` en project_firmantes (mismo estilo que el seed de pagadores).

> **Aplicación:** las migrations se aplican al Supabase remoto (Docker local no corre).
> Uso `supabase migration new` + push, igual que los días previos.

---

## 4. Modelo de firmantes (importante — leer)

`firmantes` es **biblioteca global**; `project_firmantes` es el junction (orden 1-3, único
por proyecto, **máx 3 por proyecto** por el CHECK existente). El índice único
`firmantes_email_active_uidx` sobre `lower(email)` **impide** filas duplicadas con el mismo
email → los 3 firmantes son **filas compartidas** vinculadas a los 3 proyectos, no copias.

Implicaciones de la UI (CRUD en Configuración del proyecto):
- **Agregar**: form (nombre, cargo, empresa, email). Crea/reusa el firmante por email +
  lo vincula a ESTE proyecto con el siguiente `orden` libre. Bloquea si ya hay 3.
- **Editar**: actualiza nombre, cargo, **empresa** y email del firmante.
  ⚠️ Como las filas son compartidas, **editar afecta a todos los proyectos** que comparten
  ese firmante (útil para corregir un dato una sola vez).
- **Quitar (borrar)**: elimina el vínculo `project_firmantes` de ESTE proyecto. Si el
  firmante queda sin vínculos activos, se le hace **soft-delete** (`deleted_at`).
  → Esto satisface "borrar (soft-delete)" y permite que un proyecto firme distinto:
  quitas el compartido de ese proyecto y agregas uno nuevo (email distinto) solo ahí.

> Nota: incluyo **empresa** en los forms aunque pediste "nombre + cargo + email", porque es
> `NOT NULL` y **sí aparece en el PDF** (línea "IZ Arquitectos" / "GFA"). Si no la quieres
> editable, la dejo fija y la quito del form.

---

## 5. Estructura de archivos (encapsulada, pensando en el roadmap)

```
src/lib/format/
  fecha.ts             # formatDate(iso) -> "dd/mm/yyyy" (date-fns, es)
  numero-a-letras.ts   # numeroALetras(n) -> "(SON: … PESOS XX/100 M.N.)"
  index.ts             # re-exporta lo anterior + formatMXN (sigue viviendo en utils.ts)

src/lib/email/
  resend.ts            # cliente Resend (server-only) — getResend()
  caratula-email.tsx   # template React Email (asunto + cuerpo)

src/lib/env-server.ts  # env server-only: RESEND_API_KEY, RESEND_FROM (no NEXT_PUBLIC)

src/components/caratula/
  caratula-document.tsx  # <Caratula props/> — Document de @react-pdf, puro y props-driven

src/app/proyectos/[id]/caratula/
  page.tsx               # server: fetch proyecto + estimaciones (joins) + firmantes
  actions.ts             # generarCaratula(), enviarCaratula()
  build-caratula-props.ts# ensambla CaratulaProps (reusado por generar y enviar)
  caratula-client.tsx    # dropdown + panel detalle + botones + iframe preview
  enviar-dialog.tsx      # dialog de destinatarios + confirmación de reenvío

src/app/proyectos/[id]/configuracion/
  actions.ts             # + addProjectFirmante / updateFirmante / removeProjectFirmante
  page.tsx               # + sección Firmantes (datos reales)
  firmantes-section.tsx  # client: lista + form agregar + form/dialog editar
```

- `formatMXN` **no se mueve** de `src/lib/utils.ts` (lo importan varios archivos; mover =
  riesgo de regresión). `src/lib/format/index.ts` lo re-exporta para cohesión.
- `<Caratula/>` no conoce Supabase ni acciones: recibe `CaratulaProps` y nada más.
- El cliente Resend vive en `src/lib/email/`, nunca inline en la action.

---

## 6. Flujos

### 6.1 Generar (preview)
1. `generarCaratula(estimacionId, projectId)` arma `CaratulaProps`, renderiza el PDF
   server-side a buffer (`renderToBuffer`).
2. Sube a `proyectos/{project_id}/caratulas/{estimacion_id}_generada.pdf` (**upsert**,
   se sobrescribe en cada Generar).
3. Guarda el path en `estimaciones.caratula_generada_url`.
4. Devuelve un **signed URL** → el cliente lo muestra en `<iframe>` embebido.

`@react-pdf/renderer` se queda **server-side** (fuera del bundle del cliente).

### 6.2 Enviar
"Enviar" sólo se habilita si ya existe `caratula_generada_url` (generaste primero).

1. Cliente: si `caratula_enviada_at` ya tiene valor → muestra confirm
   **"Ya enviada el dd/mm/yyyy a N destinatarios — ¿reenviar?"**. Si cancela, no pasa nada.
2. Dialog de destinatarios: campo editable prellenado con
   `project.default_emails` + `contratista.contacto_email` (si existe).
3. `enviarCaratula(estimacionId, projectId, { emails })`:
   - Renderiza el PDF fresco a buffer.
   - **Manda el correo** con Resend (PDF adjunto). Si falla → error, no persiste nada.
   - Si OK: sube copia a `proyectos/{project_id}/caratulas/{estimacion_id}_{timestamp}.pdf`,
     y actualiza `caratula_pdf_path` (path nuevo, **sobrescribe el valor** en DB),
     `caratula_enviada_at = now()`, `destinatarios_email = [...]`.
4. La estimación **no cambia de status** (sigue como esté).

> Orden "enviar → luego persistir": garantiza que `caratula_pdf_path` siempre corresponde a
> un envío exitoso. Los PDFs viejos con timestamp anterior quedan en Storage (no se
> hard-deletea, por convención del proyecto).

### Correo (Resend)
- `from`: `RESEND_FROM` (default `onboarding@resend.dev`).
- Asunto (SPEC §8): `[NAUKA {Lote}] Solicitud de pago Est. {numero} — {contratista}`.
- Cuerpo (template React Email): mensaje corto en español con contratista, partida, # y
  monto; PDF adjunto. (Texto exacto a tu gusto — pongo un default sobrio.)
- ⚠️ **Modo prueba**: con `onboarding@resend.dev`, Resend solo entrega al correo dueño de la
  cuenta. Para probar de punta a punta, pon tu correo en el dialog. Al verificar el dominio,
  cambias `RESEND_FROM` a `caratulas@izarquitectos.mx` (sin tocar código).

---

## 7. Cálculo de montos (según `caratula_iva_mode`)

Modo `con_iva` usa los `*_con_iva`; modo `sin_iva` usa los `*_sin_iva`. Sea
`importe` = monto de ESTA estimación; `ppto` = presupuesto de la partida.

- `acumulado` = Σ importe de estimaciones de la misma partida con
  `fecha_solicitud < esta` **o** (`= esta fecha` y `created_at ≤` esta) → **incluye esta**.
- `acumulado_antes` = `acumulado − importe`.
- **Header** "Contrato Total" = `ppto`; "Saldo por Ejercer" = `ppto − acumulado_antes`.
- **Tabla**: IMPORTE = `importe`; ACUMULADO = `acumulado`; PPTO = `ppto`;
  POR EJERCER = `ppto − acumulado`.
- TOTAL ESTIMACION = `importe`; debajo, `numeroALetras(importe)`.

Layout del PDF replica el Excel (header + tabla 7 columnas + AUTORIZACIONES con 3 firmas:
línea en blanco + nombre + cargo + empresa). Logo del proyecto vía signed URL si existe;
si no, se omite.

---

## 8. Variables de entorno (lo que necesito de ti)

Agregar a `.env.local` (y luego a Vercel):
```
RESEND_API_KEY=re_xxxxxxxx          # resend.com → API Keys
RESEND_FROM=onboarding@resend.dev   # cambiar a caratulas@izarquitectos.mx al verificar DNS
```
Si aún no tienes la key, construyo todo igual; el envío devuelve un error claro hasta que
la pongas. La generación/preview del PDF funciona sin Resend.

---

## 9. Validación (antes de pedirte verificación)

1. `pnpm dlx @biomejs/biome check .`
2. `pnpm tsc --noEmit`
3. `pnpm build`
   (las 3 en verde)
4. Migrations aplicadas al remoto.
5. Checklist de regresión: Flujo de Pagos intacto (CRUD, IVA, comprobante, sticky actions),
   Configuración (pagadores, logo, default_emails) intacta.

---

## 10. Resumen de superficies tocadas

- **DB**: +1 columna (`caratula_pdf_path`), +seed (3 firmantes, 9 vínculos).
- **Nuevos**: `src/lib/format/*`, `src/lib/email/*`, `src/lib/env-server.ts`,
  `src/components/caratula/caratula-document.tsx`, tab Carátula completo,
  `configuracion/firmantes-section.tsx`.
- **Editados**: `configuracion/actions.ts` (+3 actions), `configuracion/page.tsx`
  (+sección firmantes). **No** se toca Flujo de Pagos.

---

## 11. Supuestos a confirmar (puedes vetar en la revisión)

1. **empresa** editable en el form de firmantes (es NOT NULL y sale en el PDF).
2. **Editar firmante afecta a todos** los proyectos que lo comparten (modelo global por la
   restricción de email único). Para firmar distinto en un proyecto: quitar + agregar nuevo.
3. **Emails placeholder** en el seed (se corrigen por UI; no se usan para enviar).
4. Mantener **ambos** paths: `caratula_generada_url` (preview, sobrescrito) y
   `caratula_pdf_path` (copia enviada, timestamped) — como pediste.
