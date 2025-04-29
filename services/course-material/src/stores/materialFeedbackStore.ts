import { atom } from "jotai"
import type { WritableAtom } from "jotai"
import type { SetStateAction } from "react"

import { courseMaterialBlockClass } from "../utils/constants"

import type { NewProposedBlockEdit } from "@/shared-module/common/bindings"

/**
 * Types of feedback dialogs that can be displayed
 */
type CurrentlyOpenFeedbackDialog = "written" | "proposed-edits" | "select-type" | null

/**
 * Interface representing text selection state
 */
interface SelectionState {
  text: string
  position?: { x: number; y: number }
  element?: HTMLElement
}

// ------------------------------
// Utility functions
// ------------------------------

/**
 * Creates a derived atom that only allows updates when a condition is met
 * @param baseAtom - The primitive atom to wrap
 * @param condition - Function that determines if updates are allowed
 * @returns A derived atom that conditionally allows updates
 */
function createConditionalAtom<T>(
  baseAtom: WritableAtom<T, [T], void>,
  condition: (dialogType: CurrentlyOpenFeedbackDialog) => boolean,
): WritableAtom<T, [T], void> {
  return atom(
    (get) => get(baseAtom),
    (get, set, value: T) => {
      const dialogType = get(currentlyOpenFeedbackDialogPrimitiveAtom)
      if (condition(dialogType)) {
        set(baseAtom, value)
      }
    },
  )
}

// ------------------------------
// Primitive atoms (internal use only)
// ------------------------------

/**
 * Stores which feedback dialog is currently open
 */
const currentlyOpenFeedbackDialogPrimitiveAtom = atom<CurrentlyOpenFeedbackDialog>(null)

/**
 * Stores written feedback content
 */
const writtenContentPrimitiveAtom = atom<string>("")

/**
 * Stores proposed edits to course material blocks
 */
const blockEditsPrimitiveAtom = atom<Map<string, NewProposedBlockEdit>>(new Map())

/**
 * Stores the ID of the currently selected block
 */
const selectedBlockIdPrimitiveAtom = atom<string | null>(null)

/**
 * Stores the current text selection and its position
 */
const selectionPrimitiveAtom = atom<SelectionState>({ text: "" })

// ------------------------------
// Derived atoms (public API)
// ------------------------------

/**
 * Controls which feedback dialog is displayed and handles state transitions
 * between different dialog types.
 *
 * When the dialog is closed (set to null), all related state is cleared.
 */
export const currentlyOpenFeedbackDialogAtom = atom(
  (get) => get(currentlyOpenFeedbackDialogPrimitiveAtom),
  (get, set, type: CurrentlyOpenFeedbackDialog) => {
    // Clear all state when closing dialog
    if (type === null) {
      set(currentlyOpenFeedbackDialogPrimitiveAtom, null)
      set(writtenContentPrimitiveAtom, "")
      set(blockEditsPrimitiveAtom, new Map())
      set(selectedBlockIdPrimitiveAtom, null)
      set(selectionPrimitiveAtom, { text: "" })
      return
    }

    // Handle opening different dialog types
    switch (type) {
      case "written":
        set(currentlyOpenFeedbackDialogPrimitiveAtom, "written")
        set(writtenContentPrimitiveAtom, "")
        break
      case "proposed-edits": {
        set(currentlyOpenFeedbackDialogPrimitiveAtom, "proposed-edits")
        set(blockEditsPrimitiveAtom, new Map())

        // Get the selected block id from the selection (used when the dialog opened from the selected text popup), otherwise fall back to the focused block
        const selection = get(selectionPrimitiveAtom)

        const selectedBlockId =
          selection.element?.closest(`.${courseMaterialBlockClass}`)?.id ??
          document.querySelector(`.${courseMaterialBlockClass}:focus`)?.id ??
          null

        set(selectedBlockIdPrimitiveAtom, selectedBlockId)
        break
      }
      case "select-type":
        set(currentlyOpenFeedbackDialogPrimitiveAtom, "select-type")
        break
      default:
        console.error(`Unknown dialog type: ${type}`)
    }
  },
)

/**
 * Controls written feedback content
 * Only allows updates when the written feedback dialog is open
 */
export const writtenContentAtom = createConditionalAtom(
  writtenContentPrimitiveAtom,
  (dialogType) => dialogType === "written",
)

/**
 * Controls block edit proposals
 * Only allows updates when the proposed-edits dialog is open
 */
export const blockEditsAtom = atom(
  (get) => get(blockEditsPrimitiveAtom),
  (get, set, edits: SetStateAction<Map<string, NewProposedBlockEdit>>) => {
    const currentlyOpenFeedbackDialog = get(currentlyOpenFeedbackDialogPrimitiveAtom)
    if (currentlyOpenFeedbackDialog !== "proposed-edits") {
      return
    }

    const currentEdits = get(blockEditsPrimitiveAtom)
    if (typeof edits === "function") {
      set(blockEditsPrimitiveAtom, edits(currentEdits))
    } else {
      set(blockEditsPrimitiveAtom, edits)
    }
  },
)

/**
 * Controls the selected block for editing
 * Only allows updates when the proposed-edits dialog is open
 *
 * This is so because the selected block id is only needed when the proposed-edits dialog is open.
 * Q: Why does this need to be a conditional atom?
 * A: The paragraph block switches to a different component when the current paragraph is focused,
 * and if this would change whenever we select text and no feedback dialog is open, it clear the
 * selection automatically!
 */
export const selectedBlockIdAtom = createConditionalAtom(
  selectedBlockIdPrimitiveAtom,
  (dialogType) => dialogType === "proposed-edits",
)

/**
 * Controls the text selection state
 * Used for highlighting text and showing the feedback tooltip
 */
export const selectionAtom = atom(
  (get) => get(selectionPrimitiveAtom),
  (get, set, text: string, position?: { x: number; y: number }, element?: HTMLElement) => {
    const currentlyOpenDialog = get(currentlyOpenFeedbackDialogPrimitiveAtom)
    if (currentlyOpenDialog !== null && text === "") {
      // When the dialog is open, all clicks would set the text to an empty string, so we skip those.
      // Clearing the selection is done by setting the text to null.
      return
    }
    set(selectionPrimitiveAtom, { text, position, element })
  },
)
