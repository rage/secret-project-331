"use client"

import { useSelect } from "@wordpress/data"

const BLOCK_EDITOR_STORE = "core/block-editor"

/**
 * Whether the block was inserted into the editor just now, as opposed to having arrived with
 * already-saved page content.
 *
 * Stays true for as long as this is the editor's most recent insertion, so a caller acting on it
 * has to make sure it only acts once.
 */
export const useWasBlockJustInserted = (clientId: string): boolean =>
  useSelect(
    (select) =>
      // `wasBlockJustInserted` exists at runtime but is missing from the store's type defs.
      (
        select(BLOCK_EDITOR_STORE) as unknown as {
          wasBlockJustInserted: (clientId: string) => boolean
        }
      ).wasBlockJustInserted(clientId),
    [clientId],
  )
