import type { DialogQueueState } from "../src/components/dialogProvider/dialogQueue"
import {
  dialogQueueReducer,
  emptyDialogQueue,
  hasSuccessor,
} from "../src/components/dialogProvider/dialogQueue"
import type { DialogEntry } from "../src/components/dialogProvider/dialogRequests"

function entry(id: number, depth = 0): DialogEntry {
  return { id, kind: "alert", depth, request: { message: `#${id}` }, resolve: jest.fn() }
}

describe("hasSuccessor", () => {
  test("false when the only mounted dialog closes with nothing queued", () => {
    const closing = dialogQueueReducer(
      { ...emptyDialogQueue, mounted: [entry(1)] },
      { type: "close", id: 1 },
    )
    expect(hasSuccessor(closing)).toBe(false)
  })

  test("true when a dialog closes and another is already mounted alongside it", () => {
    // The handoff shape: id 1 is closing, id 2 (e.g. a depth>0 request stacked on top, or a
    // sequential request that landed before this dispatch) is still fully open.
    const state = { ...emptyDialogQueue, mounted: [entry(1), entry(2)], closingIds: [1] }
    expect(hasSuccessor(state)).toBe(true)
  })

  test("true purely from a pending request, before anything closes", () => {
    const state = { ...emptyDialogQueue, mounted: [entry(1)], pending: [entry(2)] }
    expect(hasSuccessor(state)).toBe(true)
  })

  test("false when every mounted dialog is closing and nothing is pending", () => {
    const state = { ...emptyDialogQueue, mounted: [entry(1), entry(2)], closingIds: [1, 2] }
    expect(hasSuccessor(state)).toBe(false)
  })
})

describe("dialogQueueReducer", () => {
  test("Promise.all-style batching: the second request queues behind the first, then close promotes it in one step", () => {
    let state = emptyDialogQueue
    state = dialogQueueReducer(state, { type: "request", entry: entry(1) })
    state = dialogQueueReducer(state, { type: "request", entry: entry(2) })
    expect(state.mounted.map((e) => e.id)).toEqual([1])
    expect(state.pending.map((e) => e.id)).toEqual([2])

    state = dialogQueueReducer(state, { type: "close", id: 1 })
    expect(state.mounted.map((e) => e.id)).toEqual([1, 2])
    expect(state.pending).toEqual([])
    expect(hasSuccessor(state)).toBe(true)
  })

  test("sequential await: the next request lands directly in mounted once the prior one is closing", () => {
    let state = emptyDialogQueue
    state = dialogQueueReducer(state, { type: "request", entry: entry(1) })
    state = dialogQueueReducer(state, { type: "close", id: 1 })
    expect(hasSuccessor(state)).toBe(false)

    // The `await confirm(); alert()` continuation only runs once id 1 has already resolved and
    // started closing, so this request arrives after the state above, not alongside it.
    state = dialogQueueReducer(state, { type: "request", entry: entry(2) })
    expect(state.mounted.map((e) => e.id)).toEqual([1, 2])
    expect(state.pending).toEqual([])
    expect(hasSuccessor(state)).toBe(true)
  })

  test("a depth>0 request stacks immediately even while something is open", () => {
    let state = dialogQueueReducer(emptyDialogQueue, { type: "request", entry: entry(1) })
    state = dialogQueueReducer(state, { type: "request", entry: entry(2, 1) })
    expect(state.mounted.map((e) => e.id)).toEqual([1, 2])
    expect(state.pending).toEqual([])
  })

  test("unmount drops the entry from both mounted and closingIds", () => {
    let state: DialogQueueState = { ...emptyDialogQueue, mounted: [entry(1)], closingIds: [1] }
    state = dialogQueueReducer(state, { type: "unmount", id: 1 })
    expect(state).toEqual(emptyDialogQueue)
  })
})
