import { RunResult } from "@/tmc/cli"

const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 500

type Entry = { result: RunResult | null; createdAt: number }
const store = new Map<string, Entry>()

function evict() {
  const now = Date.now()
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(id)
    }
  }
  if (store.size > MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    for (let i = 0; i < oldest.length - MAX_ENTRIES; i++) {
      store.delete(oldest[i][0])
    }
  }
}

export const testRuns = {
  set(id: string, result: RunResult | null) {
    const createdAt = result !== null ? Date.now() : (store.get(id)?.createdAt ?? Date.now())
    store.set(id, { result, createdAt })
    evict()
  },
  get(id: string): RunResult | null | undefined {
    const entry = store.get(id)
    if (!entry) {
      return undefined
    }
    if (Date.now() - entry.createdAt > TTL_MS) {
      store.delete(id)
      return undefined
    }
    return entry.result
  },
}
