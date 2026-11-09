// example-exercise stored these shapes before it versioned its blobs, and the host keeps them
// forever. A new exercise type has no such data: delete this file, its test and its calls in
// `migrateToLatest.ts`, so an unversioned blob is rejected instead of guessed at.

import { isObject } from "@/util/stateInterfaces"

/** Wraps a pre-versioning private spec, a bare `Alternative[]`, in the v1 envelope. */
export const liftLegacyPrivateSpec = (blob: unknown): unknown =>
  Array.isArray(blob) ? { version: "1", alternatives: blob } : blob

/** Wraps a pre-versioning public spec, a bare `PublicAlternative[]`, in the v1 envelope. */
export const liftLegacyPublicSpec = (blob: unknown): unknown =>
  Array.isArray(blob) ? { version: "1", options: blob } : blob

/** Stamps v1 on a pre-versioning model solution, answer or feedback, which lacked only `version`. */
export const liftLegacyObject = (blob: unknown): unknown =>
  isObject(blob) && !("version" in blob) ? { ...blob, version: "1" } : blob
