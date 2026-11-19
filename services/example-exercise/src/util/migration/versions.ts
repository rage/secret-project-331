// Single source of truth for the stored-blob version (reference/07 #1). Every stored kind (private,
// public and model-solution spec, answer, feedback) shares it, so a bump needs a step for every kind
// — see `migrateToLatest.ts`. Modelled after quizzes' `versions.ts`.

export const LATEST_SPEC_VERSION = "1" as const
export type SpecVersion = "1"

const KNOWN_VERSIONS: ReadonlySet<unknown> = new Set(["1"])

/**
 * Thrown for a stored blob with no known version or a shape no migration can read. Spec endpoints
 * answer it with `400`, grading with a `Failed` result, and the iframe views with a default.
 */
export class MalformedBlobError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "MalformedBlobError"
  }
}

/**
 * Reads a stored blob's `version`. Throws {@link MalformedBlobError} for anything but a known
 * version, including a missing one: every blob this service writes carries it.
 */
export function detectVersion(blob: unknown): SpecVersion {
  const version =
    typeof blob === "object" && blob !== null ? (blob as { version?: unknown }).version : undefined
  if (KNOWN_VERSIONS.has(version)) {
    return version as SpecVersion
  }
  throw new MalformedBlobError("Stored blob has no known version")
}
