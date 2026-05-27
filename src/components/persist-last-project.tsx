"use client"

import { useEffect } from "react"
import { setLastProjectId } from "@/lib/last-project"

type Props = {
  projectId: string
}

/**
 * Tiny client component rendered inside the project shell layout.
 * Persists the current project id to localStorage so the project
 * selector can preselect it on the user's next visit.
 */
export function PersistLastProject({ projectId }: Props) {
  useEffect(() => {
    setLastProjectId(projectId)
  }, [projectId])

  return null
}
