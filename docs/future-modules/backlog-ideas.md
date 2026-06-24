# Backlog de ideas (sin construir aún)

> Ideas parqueadas para grillear/specear cuando toque. No implementar sin grill-me + change.md.

## Import de Excel para partidas detalladas (Buy-Out) — capturado 23-jun-2026

**Idea (Alfonso):** la captura manual del 2b cubre todas las partidas (1+ líneas en formato de
22 col). Pero **Griferías, Carpinterías y Equipos de Cocina** sí llevan mucho detalle
itemizado — para esas, teclear renglón por renglón sería pesado. **Luego** agregar el **import
de Excel** (parseo del tab con preview + "cuadra al centavo") **acotado a esas partidas
detalladas**, para llenar sus líneas sin teclear. La tabla `buyout_line` ya existe; sería solo
poblarla en bloque desde el tab. No es V1.

---

## Respaldo de Storage a Dropbox — capturado 23-jun-2026

**Idea (Alfonso):** el backup diario de Supabase **NO incluye los archivos de Storage**
(comprobantes de pago, carátulas firmadas, PDFs de presupuesto) — solo la base de datos.
Hay que respaldarlos aparte porque son evidencia financiera.

**Estado:** script ya escrito en `scripts/backup-storage.mjs` (append-only: baja solo nuevos,
nunca borra; destino configurable a una carpeta de Dropbox). **Falta:** dar la ruta real de
Dropbox, una primera corrida de prueba, y programar el cron semanal.

**Pendiente al retomar:** ¿qué cadencia (semanal/diaria)? · ¿confirmar que la `service_role`
tiene permiso de leer Storage tras la rotación de keys? · ¿avisar si una corrida falla?

---

## Extras en Presupuesto (Pagos) — capturado 18-jun-2026

**Idea (Alfonso, vía colaboradores):** en la sección **Presupuesto**, un contrato/partida puede
tener **extras**: presupuestos adicionales (cambios/adicionales de obra) dentro del **mismo**
contrato. Se quiere una **sección de extras en la tabla**, distinguiendo:

`Presupuesto base + Σ extras = Presupuesto vigente`

…y que el **Resto por Pagar** y el **ejercido/acumulado** recalculen contra el vigente.

**Decidido:**
- Cada extra **lleva su propio PDF** adjunto (justificación del adicional). Reusa el patrón de
  uploads de Pagos (bucket `proyectos`, validación tipo/tamaño, admin-only).

**Preguntas abiertas a grillear:**
- ¿El extra cuelga de la **partida** existente, o es una fila aparte ligada al mismo contratista/partida?
- ¿Cada extra trae también **fecha**? ¿Necesita **aprobación** (mismo flujo de carátula) o es captura directa de admin?
- ¿Cómo se ve en **Flujo de Pagos** (columnas Presupuesto / Pagado Acum. / Resto por Pagar) y en **Resumen**? ¿Se muestra base vs extras vs total, o solo el total vigente?
- ¿Un extra puede ser **negativo** (deductiva)?
- ¿Numeración/etiqueta del extra (Extra 1, Extra 2…)?

**Impacto técnico (preliminar):** probablemente una tabla o flag de "tipo" en `partidas`/nueva
`partida_extras`, aditivo; recalcular los agregados de Resumen/Flujo. Respetar reglas de
dinero `numeric(14,2)` y soft-delete. Requiere su propio change.md.
