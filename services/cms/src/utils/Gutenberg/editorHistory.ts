import { omitUndefined } from "@/shared-module/common/utils/nullability"
import type { BlockInstance } from "@/utils/Gutenberg/types"

type EditorSelection = Record<string, unknown>

export interface GutenbergEditorSelection {
  selectionStart?: EditorSelection
  selectionEnd?: EditorSelection
  initialPosition?: number | null
}

export interface GutenbergEditorHistoryEntry {
  content: BlockInstance[]
  selection?: GutenbergEditorSelection
  /**
   * Whether further non-persistent changes coalesce into this entry instead of creating a new undo
   * level. Set on entries created from `onInput` (a typing burst) and cleared when a persistent
   * change promotes the entry.
   */
  transient?: boolean
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
  ...omitUndefined({ selection }),
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

const appendEditorHistoryEntry = (
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

/**
 * Records a non-persistent change (`onInput`), coalescing consecutive ones into a single undo level.
 *
 * The first such change after a persistent entry opens a new level, so the state before the typing
 * burst stays undoable. See `pushEditorHistoryEntry` for persistent changes.
 */
export const updateCurrentEditorHistoryEntry = (
  state: GutenbergEditorHistoryState,
  entry: GutenbergEditorHistoryEntry,
): GutenbergEditorHistoryState => {
  const transientEntry: GutenbergEditorHistoryEntry = { ...entry, transient: true }
  const current = state.entries[state.index]

  if (!current) {
    return {
      entries: [transientEntry],
      index: 0,
    }
  }

  if (!current.transient) {
    return appendEditorHistoryEntry(state, transientEntry)
  }

  const entries = state.entries.slice(0, state.index + 1)
  entries[state.index] = transientEntry

  return {
    entries,
    index: state.index,
  }
}

/**
 * Records a persistent change (`onChange`) as a new undo level, dropping any redo branch.
 *
 * Gutenberg reports the same blocks again when it marks an earlier change as persistent, so an entry
 * holding that exact content is promoted in place rather than duplicated into a no-op undo step.
 */
export const pushEditorHistoryEntry = (
  state: GutenbergEditorHistoryState,
  entry: GutenbergEditorHistoryEntry,
): GutenbergEditorHistoryState => {
  const current = state.entries[state.index]

  if (current && current.content === entry.content) {
    const entries = state.entries.slice(0, state.index + 1)
    entries[state.index] = entry

    return {
      entries,
      index: state.index,
    }
  }

  return appendEditorHistoryEntry(state, entry)
}

export interface EditorHistoryChangeOptions {
  /** Whether Gutenberg reported the change through `onChange` (persistent) or `onInput`. */
  persistent: boolean
  /** Gutenberg's flag for changes that must not become an undo level. */
  undoIgnore?: boolean | undefined
}

/** Records a change Gutenberg reported, or leaves the history untouched when it is undo-ignored. */
export const recordEditorHistoryChange = (
  state: GutenbergEditorHistoryState,
  entry: GutenbergEditorHistoryEntry,
  options: EditorHistoryChangeOptions,
): GutenbergEditorHistoryState => {
  if (options.undoIgnore) {
    return state
  }

  return options.persistent
    ? pushEditorHistoryEntry(state, entry)
    : updateCurrentEditorHistoryEntry(state, entry)
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
