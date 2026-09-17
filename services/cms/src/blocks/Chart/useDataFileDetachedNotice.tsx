"use client"

import { useEffect, useMemo, useState } from "react"

import { specLacksDataSource } from "./chartSpec"

// The offer appears only once editing pauses, so it doesn't flash while a data block is being
// retyped. It disappears immediately, so acting on it feels instant.
const EDITING_PAUSE_MS = 800

const RESTORE_CONFIRMATION_MS = 5000

interface DataFileDetachedNotice {
  /** The attached data file is no longer referenced by the spec, so the chart has no data. */
  isDetached: boolean
  /** The file was just put back — announced because the notice is gone and the chart is visual. */
  restoreConfirmed: boolean
  /** Announces the restore; clears itself after a few seconds. */
  confirmRestore: () => void
}

/**
 * Tracks whether the spec has stopped referencing the block's data file, which is how an edit
 * leaves an attached file unused, and lets the teacher be told when it has been put back.
 */
export const useDataFileDetachedNotice = ({
  spec,
  dataFileUrl,
}: {
  spec: string
  dataFileUrl: string | undefined
}): DataFileDetachedNotice => {
  const isDetachedNow = useMemo(
    () => dataFileUrl !== undefined && specLacksDataSource(spec),
    [dataFileUrl, spec],
  )

  const [isDetached, setIsDetached] = useState(false)
  useEffect(() => {
    if (!isDetachedNow) {
      setIsDetached(false)
      return
    }
    const timeout = setTimeout(() => setIsDetached(true), EDITING_PAUSE_MS)
    return () => clearTimeout(timeout)
  }, [isDetachedNow])

  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  useEffect(() => {
    if (!restoreConfirmed) {
      return
    }
    const timeout = setTimeout(() => setRestoreConfirmed(false), RESTORE_CONFIRMATION_MS)
    return () => clearTimeout(timeout)
  }, [restoreConfirmed])

  return { isDetached, restoreConfirmed, confirmRestore: () => setRestoreConfirmed(true) }
}
