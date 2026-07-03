# Arranque en máquina nueva (Mac de viaje) — NAUKA Pagos

> Para retomar el proyecto en otra Mac sin perder nada. Fuente de verdad del CÓDIGO =
> GitHub. Los archivos sueltos (secretos, Excels) van por la nube/USB, NO por git.

## Antes de salir de la máquina actual (viernes)

1. Corre el prompt de respaldo en Claude Code → confirma que estas ramas quedaron en `origin`:
   - `main`
   - `feat/buyout-historial`
   - `feat/ui-profesional` (si existe)
   - cualquier otra `feat/*` con trabajo local
2. Copia a la nube/USB (NO están en GitHub, gitignored):
   - [ ] **`.env.local`** ← CRÍTICO, sin esto la app no corre
   - [ ] `reference/*.xlsx` (Excels fuente de BF/L3)
   - [ ] `scripts/backup-storage.mjs`

## En la Mac de viaje (lunes)

### 1. Herramientas (confirmar que están instaladas)
- [ ] git
- [ ] Node (misma versión mayor que la actual)
- [ ] pnpm  (`npm i -g pnpm`)
- [ ] Claude Code
- [ ] Supabase CLI (solo si vas a correr migraciones locales)

### 2. Traer el código
```bash
git clone <URL del repo nauka-pagos en GitHub>
cd "nauka-pagos"      # o el nombre de la carpeta
```
> Si ya tienes la carpeta vía nube: NO la uses tal cual. Mejor `git fetch --all` y
> `git pull` en cada rama; si el `.git` viene raro, re-clona limpio.

### 3. Poner los archivos sueltos
- [ ] Pega `.env.local` en la raíz del proyecto
- [ ] Pega `reference/*.xlsx` (si los quieres)

### 4. Instalar y correr
```bash
pnpm install
pnpm dev            # http://localhost:3000
```

### 5. Retomar donde quedaste
```bash
git checkout feat/buyout-historial   # o la rama en la que sigas
```
- Lee **`docs/contexto-sesion-2026-07-03.md`** → estado completo y pendientes.
- Lee **`docs/audit-app-completa-2026-07-03.md`** → el bug-hunt (empieza por C1 🔴).

## Recordatorios
- **NUNCA push sin autorización.** Producción está en `285a6ca`.
- Pendiente antes de seguir features: **fix C1 🔴** (Historial/puente a Pagos suman solo
  la 1ª línea → BF a la mitad) + A1/A2. Prompt en el contexto.
- Historial y UI-piloto viven en ramas locales/remotas, **sin push a producción**.
- No commitear `reference/*.xlsx`, `scripts/backup-storage.mjs`, `.env*`.
