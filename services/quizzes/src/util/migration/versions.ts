/**
 * Single source of truth for the quiz spec version.
 *
 * All four stored blob kinds (private spec, public spec, model solution spec, user answer) share
 * one version number: the quiz spec as a whole is at `LATEST_QUIZ_VERSION`. Bumping the version is
 * how a data-model change is rolled out — see `migrateToLatest.ts` for how a new step is added.
 */

/** v1 is the pre-version "old quiz" format: its blobs have no `version` field at all. */
export const OLDEST_QUIZ_VERSION = "1" as const
export const LATEST_QUIZ_VERSION = "3" as const
export type QuizSpecVersion = "1" | "2" | "3"

/** A stored blob with no `version` field is the v1 ("old quiz") format. */
export function detectQuizVersion(blob: unknown): QuizSpecVersion {
  if (blob !== null && typeof blob === "object" && "version" in blob) {
    return (blob as { version: QuizSpecVersion }).version
  }
  return OLDEST_QUIZ_VERSION
}
