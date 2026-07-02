"use client"

import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { ConceptoRow, PartidaRow } from "./actions"
import { DeleteConceptoButton } from "./delete-concepto-button"
import { DeletePartidaButton } from "./delete-partida-button"
import { EditConceptoButton } from "./edit-concepto-button"
import { EditPartidaButton } from "./edit-partida-button"
import { NuevoConceptoButton } from "./nuevo-concepto-button"
import { ReordenarConcepto } from "./reordenar-concepto"

type Props = {
  projectId: string
  partida: PartidaRow
  conceptos: ConceptoRow[]
  chapterNames: string[]
  admin: boolean
}

/** Fila de partida EXPANDIBLE: cabecera + panel de conceptos de esa partida. */
export function PartidaRowView({
  projectId,
  partida,
  conceptos,
  chapterNames,
  admin,
}: Props) {
  const [open, setOpen] = useState(false)
  const conDatos = partida.itemCount > 0
  const nextOrden = conceptos.length
    ? Math.max(...conceptos.map((c) => c.orden)) + 1
    : 0

  return (
    <li>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-nauka-bg">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span
            aria-hidden
            title={conDatos ? "Con datos capturados" : "Sin datos"}
            className={cn(
              "inline-block size-2 shrink-0 rounded-full",
              conDatos ? "bg-nauka-success" : "bg-nauka-neutral/40",
            )}
          />
          <span className="truncate text-sm font-medium text-nauka-dark">
            {partida.nombre}
          </span>
          {partida.unidad_driver ? (
            <span className="shrink-0 rounded-full bg-nauka-subtle px-2 py-0.5 text-xs text-muted-foreground">
              {partida.unidad_driver}
            </span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {conceptos.length > 0
              ? `${conceptos.length} concepto${conceptos.length === 1 ? "" : "s"}`
              : "—"}
          </span>
          {admin ? (
            <div className="flex items-center">
              <EditPartidaButton
                projectId={projectId}
                chapterNames={chapterNames}
                partida={{
                  id: partida.id,
                  nombre: partida.nombre,
                  chapter_default: partida.chapter_default,
                  unidad_driver: partida.unidad_driver,
                }}
              />
              <DeletePartidaButton
                projectId={projectId}
                partidaId={partida.id}
                nombre={partida.nombre}
                itemCount={partida.itemCount}
              />
            </div>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="border-t border-nauka-subtle bg-nauka-bg/60 px-4 py-3 pl-11">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Conceptos
            </span>
            {admin ? (
              <NuevoConceptoButton
                projectId={projectId}
                partidaId={partida.id}
                nextOrden={nextOrden}
              />
            ) : null}
          </div>
          {conceptos.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Esta partida no tiene conceptos en el catálogo.
            </p>
          ) : (
            <ul className="divide-y divide-nauka-subtle">
              {conceptos.map((c, i) => (
                <ConceptoLine
                  key={c.id}
                  projectId={projectId}
                  concepto={c}
                  isFirst={i === 0}
                  isLast={i === conceptos.length - 1}
                  admin={admin}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  )
}

function ConceptoLine({
  projectId,
  concepto,
  isFirst,
  isLast,
  admin,
}: {
  projectId: string
  concepto: ConceptoRow
  isFirst: boolean
  isLast: boolean
  admin: boolean
}) {
  const conDatos = concepto.itemCount > 0
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          title={conDatos ? "Con datos capturados" : "Sin datos"}
          className={cn(
            "inline-block size-1.5 shrink-0 rounded-full",
            conDatos ? "bg-nauka-success" : "bg-nauka-neutral/40",
          )}
        />
        <span className="truncate text-sm text-nauka-dark">
          {concepto.nombre}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {conDatos
            ? `${concepto.itemCount} dato${concepto.itemCount === 1 ? "" : "s"}`
            : "—"}
        </span>
        {admin ? (
          <div className="flex items-center">
            <ReordenarConcepto
              projectId={projectId}
              conceptoId={concepto.id}
              nombre={concepto.nombre}
              isFirst={isFirst}
              isLast={isLast}
            />
            <EditConceptoButton
              projectId={projectId}
              conceptoId={concepto.id}
              nombre={concepto.nombre}
            />
            <DeleteConceptoButton
              projectId={projectId}
              conceptoId={concepto.id}
              nombre={concepto.nombre}
              itemCount={concepto.itemCount}
            />
          </div>
        ) : null}
      </div>
    </li>
  )
}
