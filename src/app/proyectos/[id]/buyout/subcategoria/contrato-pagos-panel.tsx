"use client"

import { CircleCheck, ExternalLink, Link2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PagosLinkInfo } from "@/lib/buyout/pagos-link"
import { formatMXN } from "@/lib/utils"
import {
  crearContratoPagos,
  resincronizarContratoPagos,
} from "./contrato-actions"

type Props = {
  projectId: string
  itemId: string
  admin: boolean
  /** Estado contratación de la cotización VIGENTE. */
  contratado: boolean
  /** Enlace vivo a Pagos, o null si no está ligado (o la partida se borró). */
  link: PagosLinkInfo | null
  /** La cotización tiene `pagos_partida_id` pero la partida fue borrada en Pagos. */
  staleLink: boolean
  conceptoNombre: string
  proveedor: string | null
  /** Total MXN (con IVA) de la cotización vigente — lo que tendrá el contrato. */
  totalMxn: number
}

/**
 * Panel "Contrato en Pagos" del historial de un concepto (SPEC-buyout.md §8). Si
 * la cotización vigente está CONTRATADA y aún no ligada, el admin crea/liga el
 * contrato en la sección Presupuesto de Pagos. Una vez ligado, muestra el enlace
 * a la partida y permite re-sincronizar su monto. Si no está contratada, explica
 * cómo habilitarlo.
 */
export function ContratoPagosPanel({
  projectId,
  itemId,
  admin,
  contratado,
  link,
  staleLink,
  conceptoNombre,
  proveedor,
  totalMxn,
}: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-nauka-card-border bg-white shadow-nauka-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-nauka-subtle px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-nauka-dark">
          <Link2 className="size-4 text-nauka-neutral" />
          Contrato en Pagos
        </h3>
        <p className="text-xs text-muted-foreground">
          El cruce con Pagos: registra el contrato para capturar pagos.
        </p>
      </header>

      <div className="px-4 py-3">
        {link ? (
          <LigadoView
            projectId={projectId}
            itemId={itemId}
            admin={admin}
            link={link}
          />
        ) : !contratado ? (
          <p className="text-sm text-muted-foreground">
            Marca la versión vigente como{" "}
            <span className="font-medium text-nauka-dark">Contratada</span> (al
            editarla en la Partida) para poder crear/ligar su contrato en Pagos.
          </p>
        ) : (
          <NoLigadoView
            projectId={projectId}
            itemId={itemId}
            admin={admin}
            staleLink={staleLink}
            conceptoNombre={conceptoNombre}
            proveedor={proveedor}
            totalMxn={totalMxn}
          />
        )}
      </div>
    </section>
  )
}

// --- Ya ligado --------------------------------------------------------------

function LigadoView({
  projectId,
  itemId,
  admin,
  link,
}: {
  projectId: string
  itemId: string
  admin: boolean
  link: PagosLinkInfo
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          <CircleCheck className="size-3" />
          Ligado a Pagos
        </span>
        <span className="truncate text-sm text-nauka-dark">
          <span className="font-medium">{link.contratistaNombre || "—"}</span>
          {" · "}
          {link.partidaNombre}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/proyectos/${projectId}/presupuesto`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-3 transition-colors hover:text-nauka-dark hover:underline"
        >
          Ver en Presupuesto
          <ExternalLink className="size-3.5" />
        </Link>
        {admin ? (
          <ResincronizarButton projectId={projectId} itemId={itemId} />
        ) : null}
      </div>
    </div>
  )
}

// --- Contratado pero sin ligar ---------------------------------------------

function NoLigadoView({
  projectId,
  itemId,
  admin,
  staleLink,
  conceptoNombre,
  proveedor,
  totalMxn,
}: {
  projectId: string
  itemId: string
  admin: boolean
  staleLink: boolean
  conceptoNombre: string
  proveedor: string | null
  totalMxn: number
}) {
  return (
    <div className="flex flex-col gap-2">
      {staleLink ? (
        <p className="text-sm text-amber-700">
          El contrato que estaba ligado ya no existe en Pagos (se eliminó).
          Puedes crearlo de nuevo.
        </p>
      ) : null}
      {admin ? (
        <CrearContratoButton
          projectId={projectId}
          itemId={itemId}
          conceptoNombre={conceptoNombre}
          proveedor={proveedor}
          totalMxn={totalMxn}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Solo un administrador puede crear el contrato en Pagos.
        </p>
      )}
    </div>
  )
}

// --- Botón crear ------------------------------------------------------------

function CrearContratoButton({
  projectId,
  itemId,
  conceptoNombre,
  proveedor,
  totalMxn,
}: {
  projectId: string
  itemId: string
  conceptoNombre: string
  proveedor: string | null
  totalMxn: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await crearContratoPagos(projectId, itemId)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="w-fit"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <Link2 />
        Crear/ligar contrato en Pagos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Crear el contrato en Pagos?</DialogTitle>
            <DialogDescription>
              {error ??
                `Se registrará en Presupuesto de Pagos el contratista “${
                  proveedor ?? "—"
                }” y la partida “${conceptoNombre}” por ${formatMXN(
                  totalMxn,
                )} (con IVA). Si el contratista ya existe, se reutiliza. Después podrás capturar pagos contra esa partida.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {error ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <DialogClose
                  render={<Button variant="outline" disabled={pending} />}
                >
                  Cancelar
                </DialogClose>
                <Button onClick={handleConfirm} disabled={pending}>
                  {pending ? "Creando…" : "Sí, crear contrato"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// --- Botón re-sincronizar ---------------------------------------------------

function ResincronizarButton({
  projectId,
  itemId,
}: {
  projectId: string
  itemId: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await resincronizarContratoPagos(projectId, itemId)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <RefreshCw />
        Re-sincronizar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Re-sincronizar el monto?</DialogTitle>
            <DialogDescription>
              {error ??
                "El presupuesto de la partida en Pagos se actualizará con el monto contratado actual de este concepto (sin IVA + IVA). No cambia el contratista, el nombre ni los pagos ya capturados."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {error ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <DialogClose
                  render={<Button variant="outline" disabled={pending} />}
                >
                  Cancelar
                </DialogClose>
                <Button onClick={handleConfirm} disabled={pending}>
                  {pending ? "Sincronizando…" : "Sí, re-sincronizar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
