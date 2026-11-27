import type { ExerciseFile } from "@/util/stateInterfaces"

const KEY_PREFIX = "tmc-draft:v1:"
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

/** Browser-editor work not yet submitted, kept in this browser's localStorage. */
export interface LocalDraft {
  files: ExerciseFile[]
  /** What the editor was seeded from when the draft was written; see {@link draftBasis}. */
  basis: string
  /** When the draft was written, as an ISO timestamp from this browser's clock. Used for pruning. */
  savedAt: string
}

/**
 * Identifies the starting point a draft was edited from: the stub's checksum and the stored answer
 * the editor opened, if any. A draft applies only while both are unchanged, so a new submission
 * (from any browser or VS Code) or a new template supersedes it without comparing clocks.
 */
export function draftBasis(stubChecksum: string, seededArchiveId: string | null): string {
  return `${stubChecksum}:${seededArchiveId ?? ""}`
}

/** The storage key of one user's draft for one task. */
export function draftKey(userId: string, exerciseTaskId: string): string {
  return `${KEY_PREFIX}${userId}:${exerciseTaskId}`
}

function isLocalDraft(value: unknown): value is LocalDraft {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const { files, basis, savedAt } = value as Partial<LocalDraft>
  return (
    typeof basis === "string" &&
    typeof savedAt === "string" &&
    !Number.isNaN(Date.parse(savedAt)) &&
    Array.isArray(files) &&
    files.every(
      (file: unknown) =>
        typeof file === "object" &&
        file !== null &&
        typeof (file as ExerciseFile).filepath === "string" &&
        typeof (file as ExerciseFile).contents === "string",
    )
  )
}

/** The stored draft, or null when there is none or storage is unavailable or holds garbage. */
export function loadDraft(key: string): LocalDraft | null {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === null) {
      return null
    }
    const draft: unknown = JSON.parse(stored)
    return isLocalDraft(draft) ? draft : null
  } catch {
    return null
  }
}

/** Stores the files as the draft. Fails silently. */
export function saveDraft(
  key: string,
  files: readonly ExerciseFile[],
  basis: string,
  now = new Date(),
): void {
  try {
    const draft: LocalDraft = { files: [...files], basis, savedAt: now.toISOString() }
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Storage full or blocked: the draft is a convenience, the submitted answer is the record.
  }
}

/** Drops drafts not saved for half a year. Fails silently. */
export function pruneDrafts(now = new Date()): void {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i)
      if (key === null || !key.startsWith(KEY_PREFIX)) {
        continue
      }
      const draft = loadDraft(key)
      if (draft === null || now.getTime() - Date.parse(draft.savedAt) > MAX_AGE_MS) {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // As in saveDraft.
  }
}

/** Forgets the draft. Fails silently. */
export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // As in saveDraft.
  }
}
