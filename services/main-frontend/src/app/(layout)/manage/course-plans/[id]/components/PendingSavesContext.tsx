"use client"

import React, { createContext, useContext, useEffect, useMemo, useRef } from "react"

/** Saves a form's unsaved edits now; resolves to whether everything was saved. */
type SavePendingEdits = () => Promise<boolean>

interface PendingSaves {
  /** Saves the unsaved edits of every autosaving form on the plan's pages. */
  saveAll: () => Promise<boolean>
  register: (save: SavePendingEdits) => () => void
}

const PendingSavesContext = createContext<PendingSaves | null>(null)

/**
 * Lets code outside the plan's autosaving forms, such as the assistant applying a change, save
 * their unsaved edits first: a form with unsaved edits does not take in server changes, and its
 * next save would overwrite them.
 */
export function PendingSavesProvider({ children }: { children: React.ReactNode }) {
  const savesRef = useRef(new Set<SavePendingEdits>())
  const pendingSaves = useMemo<PendingSaves>(
    () => ({
      saveAll: async () => {
        const results = await Promise.all(Array.from(savesRef.current, (save) => save()))
        return results.every(Boolean)
      },
      register: (save) => {
        savesRef.current.add(save)
        return () => {
          savesRef.current.delete(save)
        }
      },
    }),
    [],
  )
  return <PendingSavesContext value={pendingSaves}>{children}</PendingSavesContext>
}

/** The plan's pending saves, or null outside a plan page. */
export function usePendingSaves(): PendingSaves | null {
  return useContext(PendingSavesContext)
}

/** Includes `save` in `saveAll` while the calling form is mounted. */
export function useRegisterPendingSave(save: SavePendingEdits) {
  const pendingSaves = usePendingSaves()
  useEffect(() => pendingSaves?.register(save), [pendingSaves, save])
}
