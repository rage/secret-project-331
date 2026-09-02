import type { DialogEntry } from "./dialogRequests"

export interface DialogQueueState {
  /** Mounted dialogs, in mount order. Includes the ones animating out. */
  mounted: readonly DialogEntry[]
  /** Ids within `mounted` that have been answered and are only waiting for their exit animation. */
  closingIds: readonly number[]
  /** Depth-0 requests waiting for the surface to free up, in call order. */
  pending: readonly DialogEntry[]
}

export type DialogQueueAction =
  | { type: "request"; entry: DialogEntry }
  | { type: "close"; id: number }
  | { type: "unmount"; id: number }

export const emptyDialogQueue: DialogQueueState = { mounted: [], closingIds: [], pending: [] }

export function isDialogOpen(state: DialogQueueState, id: number): boolean {
  return !state.closingIds.includes(id)
}

function openCount(state: DialogQueueState): number {
  return state.mounted.length - state.closingIds.length
}

/**
 * Whether a dialog closing now will hand over to another one rather than leaving the page bare.
 * Drives `Dialog`'s `exit="handoff"`, and has to be known while the dialog is still open, because
 * the exit animation runs against the props of its last open render.
 */
export function hasSuccessor(state: DialogQueueState): boolean {
  return openCount(state) > 1 || state.pending.length > 0
}

export function dialogQueueReducer(
  state: DialogQueueState,
  action: DialogQueueAction,
): DialogQueueState {
  switch (action.type) {
    case "request": {
      // A request from inside a dialog body stacks immediately. Queueing it would deadlock: it
      // waits for the dialog below to close, and that dialog waits for the body's answer.
      if (action.entry.depth > 0 || openCount(state) === 0) {
        return { ...state, mounted: [...state.mounted, action.entry] }
      }
      return { ...state, pending: [...state.pending, action.entry] }
    }
    case "close": {
      if (
        !state.mounted.some((entry) => entry.id === action.id) ||
        !isDialogOpen(state, action.id)
      ) {
        return state
      }
      const closed: DialogQueueState = {
        ...state,
        closingIds: [...state.closingIds, action.id],
      }
      const [next, ...rest] = closed.pending
      if (next === undefined || openCount(closed) > 0) {
        return closed
      }
      return { ...closed, mounted: [...closed.mounted, next], pending: rest }
    }
    case "unmount": {
      return {
        ...state,
        mounted: state.mounted.filter((entry) => entry.id !== action.id),
        closingIds: state.closingIds.filter((id) => id !== action.id),
      }
    }
  }
}
