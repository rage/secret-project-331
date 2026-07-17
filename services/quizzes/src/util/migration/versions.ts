/**
 * Single source of truth for the quiz spec version.
 *
 * All four stored blob kinds (private spec, public spec, model solution spec, user answer) share
 * one version number: the quiz spec as a whole is at `LATEST_QUIZ_VERSION`. Bumping the version is
 * how a data-model change is rolled out — see `migrateToLatest.ts` for how a new step is added.
 */

/** v1 is the pre-version "old quiz" format: its blobs have no `version` field at all. */
export const OLDEST_QUIZ_VERSION = "1" as const
export const LATEST_QUIZ_VERSION = "4" as const
export type QuizSpecVersion = "1" | "2" | "3" | "4"

const KNOWN_QUIZ_VERSIONS: ReadonlySet<string> = new Set(["1", "2", "3", "4"])

/**
 * A stored blob with no `version` field is the v1 ("old quiz") format. Any other value than a known
 * version string is a malformed blob and throws, so hostile values (`"__proto__"`, numbers, nulls)
 * fail here with a clear error instead of dispatching into the migration registries.
 */
export function detectQuizVersion(blob: unknown): QuizSpecVersion {
  if (blob === null || typeof blob !== "object" || !("version" in blob)) {
    return OLDEST_QUIZ_VERSION
  }
  const version = (blob as { version: unknown }).version
  if (typeof version === "string" && KNOWN_QUIZ_VERSIONS.has(version)) {
    return version as QuizSpecVersion
  }
  throw new Error(`Malformed quiz blob: unsupported version ${JSON.stringify(version)}`)
}
