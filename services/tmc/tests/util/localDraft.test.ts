import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearDraft,
  draftBasis,
  draftKey,
  loadDraft,
  pruneDrafts,
  saveDraft,
} from "@/util/localDraft"

const FILES = [{ filepath: "src/main.py", contents: "print(1)\n" }]
const KEY = draftKey("user-1", "task-1")
const BASIS = draftBasis("stub-checksum", "archive-1")

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("local drafts", () => {
  it("round-trips the files with their basis and the time they were saved", () => {
    saveDraft(KEY, FILES, BASIS, new Date("2026-11-26T12:00:00Z"))
    expect(loadDraft(KEY)).toEqual({
      files: FILES,
      basis: BASIS,
      savedAt: "2026-11-26T12:00:00.000Z",
    })
    clearDraft(KEY)
    expect(loadDraft(KEY)).toBeNull()
  })

  it("keeps drafts of different users and tasks apart", () => {
    saveDraft(KEY, FILES, BASIS)
    expect(loadDraft(draftKey("user-2", "task-1"))).toBeNull()
    expect(loadDraft(draftKey("user-1", "task-2"))).toBeNull()
  })

  it("treats unreadable storage contents as no draft", () => {
    window.localStorage.setItem(KEY, "{not json")
    expect(loadDraft(KEY)).toBeNull()
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ files: [{ filepath: 1 }], basis: BASIS, savedAt: "x" }),
    )
    expect(loadDraft(KEY)).toBeNull()
  })

  it("fails silently when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError")
    })
    expect(() => saveDraft(KEY, FILES, BASIS)).not.toThrow()
    expect(loadDraft(KEY)).toBeNull()
  })

  it("prunes drafts that have not been touched for half a year", () => {
    const stale = draftKey("user-1", "old-task")
    saveDraft(stale, FILES, BASIS, new Date("2026-01-01T00:00:00Z"))
    saveDraft(KEY, FILES, BASIS, new Date("2026-11-26T00:00:00Z"))
    pruneDrafts(new Date("2026-11-26T00:00:00Z"))
    expect(loadDraft(stale)).toBeNull()
    expect(loadDraft(KEY)).not.toBeNull()
  })
})

describe("draftBasis", () => {
  it("changes with the stored answer and with the stub", () => {
    expect(draftBasis("a", null)).not.toBe(draftBasis("a", "archive-1"))
    expect(draftBasis("a", "archive-1")).not.toBe(draftBasis("b", "archive-1"))
  })
})
