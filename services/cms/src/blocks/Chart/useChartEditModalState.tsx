"use client"

import { useSelect } from "@wordpress/data"
import { useEffect, useRef, useState } from "react"

const BLOCK_EDITOR_STORE = "core/block-editor"

interface ChartEditModal {
  isModalOpen: boolean
  openModal: () => void
  closeModal: () => void
}

/**
 * Open state of the chart's editing modal, which opens by itself for a brand-new block so the
 * teacher lands on the data-file step.
 *
 * Auto-opening happens once, and only for a block inserted empty — not when saved content loads.
 */
export const useChartEditModalState = ({
  clientId,
  spec,
}: {
  clientId: string
  spec: string | undefined
}): ChartEditModal => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const wasJustInserted = useSelect(
    (select) =>
      // `wasBlockJustInserted` exists at runtime but is missing from the store's type defs.
      (
        select(BLOCK_EDITOR_STORE) as unknown as {
          wasBlockJustInserted: (clientId: string) => boolean
        }
      ).wasBlockJustInserted(clientId),
    [clientId],
  )

  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (!autoOpenedRef.current && wasJustInserted && !spec?.trim()) {
      autoOpenedRef.current = true
      setIsModalOpen(true)
    }
  }, [wasJustInserted, spec])

  return {
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
  }
}
