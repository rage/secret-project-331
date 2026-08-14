"use client"

import { useSelect } from "@wordpress/data"

const BLOCK_EDITOR_STORE = "core/block-editor"

interface BlockEditorPreviewSelectors {
  getSettings: () => { isPreviewMode?: boolean }
}

/**
 * Whether the surrounding block list is a preview (inserter preview, list view thumbnail) rather
 * than the editable document.
 *
 * For use in `editor.BlockEdit` filters, which must not add editing affordances to previews.
 * Gutenberg passes `isPreviewMode` as a prop to core block edit components, but its `BlockEdit`
 * wrapper strips the prop before the filters run, so the editor settings of the preview's nested
 * store are the only route to it.
 */
export const useIsBlockPreviewMode = (): boolean =>
  useSelect(
    (select) =>
      Boolean(
        (select(BLOCK_EDITOR_STORE) as BlockEditorPreviewSelectors).getSettings().isPreviewMode,
      ),
    [],
  )
