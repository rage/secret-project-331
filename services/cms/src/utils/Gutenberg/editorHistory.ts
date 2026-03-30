import type { EditorSelection } from "@wordpress/block-editor"
import type { BlockInstance } from "@wordpress/blocks"

export interface GutenbergEditorSelection {
  selectionStart?: EditorSelection
  selectionEnd?: EditorSelection
  initialPosition?: number | null
}

export interface GutenbergEditorHistoryEntry {
  content: BlockInstance[]
  selection?: GutenbergEditorSelection
}

export interface GutenbergEditorHistoryState {
  entries: GutenbergEditorHistoryEntry[]
  index: number
}

export const createEditorHistoryEntry = (
  content: BlockInstance[],
  selection?: GutenbergEditorSelection,
): GutenbergEditorHistoryEntry => ({
  content,
  selection,
})

export const initializeEditorHistory = (
  content: BlockInstance[],
  selection?: GutenbergEditorSelection,
): GutenbergEditorHistoryState => ({
  entries: [createEditorHistoryEntry(content, selection)],
  index: 0,
})

export const getCurrentEditorHistoryEntry = (
  state: GutenbergEditorHistoryState,
): GutenbergEditorHistoryEntry | undefined => state.entries[state.index]

export const updateCurrentEditorHistoryEntry = (
  state: GutenbergEditorHistoryState,
  entry: GutenbergEditorHistoryEntry,
): GutenbergEditorHistoryState => {
  if (state.entries.length === 0) {
    return {
      entries: [entry],
      index: 0,
    }
  }

  const index = Math.min(state.index, state.entries.length - 1)
  const entries = state.entries.slice(0, index + 1)
  entries[index] = entry

  return {
    entries,
    index,
  }
}

export const pushEditorHistoryEntry = (
  state: GutenbergEditorHistoryState,
  entry: GutenbergEditorHistoryEntry,
): GutenbergEditorHistoryState => {
  const entries = state.entries.slice(0, state.index + 1)
  entries.push(entry)

  return {
    entries,
    index: entries.length - 1,
  }
}

export const canUndoEditorHistory = (state: GutenbergEditorHistoryState): boolean => state.index > 0

export const canRedoEditorHistory = (state: GutenbergEditorHistoryState): boolean =>
  state.index < state.entries.length - 1

export const undoEditorHistory = (
  state: GutenbergEditorHistoryState,
): GutenbergEditorHistoryState => {
  if (!canUndoEditorHistory(state)) {
    return state
  }

  return {
    entries: state.entries,
    index: state.index - 1,
  }
}

export const redoEditorHistory = (
  state: GutenbergEditorHistoryState,
): GutenbergEditorHistoryState => {
  if (!canRedoEditorHistory(state)) {
    return state
  }

  return {
    entries: state.entries,
    index: state.index + 1,
  }
}
