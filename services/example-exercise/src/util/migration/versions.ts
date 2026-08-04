// Single source of truth for the stored-blob version (reference/07 #1). All four stored kinds
// (private/public/model-solution spec, answer) share one version. Bumping it rolls out a data-model
// change — see `migrateToLatest.ts` for adding a step. Modelled after quizzes' `versions.ts`.

/** v1 is also the pre-version format: its blobs may have no `version` field at all. */
export const OLDEST_SPEC_VERSION = "1" as const
export const LATEST_SPEC_VERSION = "1" as const
export type SpecVersion = "1"

const KNOWN_VERSIONS: ReadonlySet<string> = new Set(["1"])

/**
 * No `version` field → the oldest (v1) format. A known version string is returned as-is; anything
 * else (future/unknown version, or a hostile value) throws — fail loud rather than dispatch a shape
 * we cannot lift. Forgiving callers (the iframe views) catch this.
 */
export function detectVersion(blob: unknown): SpecVersion {
  if (blob === null || typeof blob !== "object" || !("version" in blob)) {
    return OLDEST_SPEC_VERSION
  }
  const version = (blob as { version: unknown }).version
  if (typeof version === "string" && KNOWN_VERSIONS.has(version)) {
    return version as SpecVersion
  }
  throw new Error(`Malformed stored blob: unsupported version ${JSON.stringify(version)}`)
}
