/**
 * Value-aware leak guard for student-visible projections.
 *
 * A key-only guard ("does the word `correct` appear as a key?") gives false confidence: it misses a
 * leak that was renamed or moved into a *value* (e.g. an option named "Paris (the answer)", or a new
 * field that copies solution text). This guard checks BOTH dimensions:
 *
 *   1. forbidden KEYS   — no object anywhere in the projection uses one of these property names.
 *   2. forbidden VALUES — none of the private spec's answer-revealing strings survive into the
 *                         projection as a serialized JSON string token (a key, element, or value).
 *                         Matching the quoted token rather than a bare substring avoids false
 *                         positives where a short value coincides with the hex of a legitimate id.
 *
 * It is meant to run right before a projection is served, and to FAIL CLOSED: on any suspected leak
 * it throws, so the endpoint returns an error instead of shipping the leak (see `jsonRoute`, which
 * turns a thrown non-`BadRequestError` into a 500). Better a failed request than a leaked answer.
 */
export class LeakError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "LeakError"
  }
}

export interface LeakGuardOptions {
  /** Property names that must not appear anywhere in the projection (e.g. `["correct"]`). */
  forbiddenKeys: string[]
  /**
   * Exact string values that must not appear anywhere in the serialized projection. Derive these
   * from the private spec's answer-revealing content (solution text, incorrect-option ids, option
   * names the projection is not allowed to expose, ...). Empty strings are ignored.
   */
  forbiddenValues: string[]
}

function walk(value: unknown, visit: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit)
    }
    return
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      visit(key, nested)
      walk(nested, visit)
    }
  }
}

/**
 * Throws {@link LeakError} if `projection` contains any forbidden key or forbidden value. Call this
 * on the object you are about to serve to students; do not catch the error at the call site — let it
 * propagate so the request fails closed.
 */
export function assertNoLeak(projection: unknown, options: LeakGuardOptions): void {
  walk(projection, (key) => {
    if (options.forbiddenKeys.includes(key)) {
      throw new LeakError(`Projection leaked a forbidden key: "${key}"`)
    }
  })

  const serialized = JSON.stringify(projection) ?? ""
  for (const forbidden of options.forbiddenValues) {
    // Match the forbidden value as a complete JSON string token (quotes included), not a bare
    // substring. A short value — e.g. a single-character option name like "a" — would otherwise
    // collide with the hex of a legitimately-present id (correct-option UUIDs contain a/b/c/...) and
    // make the guard fail closed on valid input. A genuine leak surfaces the value as its own
    // serialized string (a key, array element, or property value), which the quoted form still
    // catches; `JSON.stringify` on both sides also keeps escaping consistent.
    if (forbidden !== "" && serialized.includes(JSON.stringify(forbidden))) {
      throw new LeakError(`Projection leaked a forbidden value: "${forbidden}"`)
    }
  }
}
