import { ErrorResponse } from "../errorApiTypes"
import { AppApiError } from "../errors/AppApiError"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// usage: validateResponse(data, isOrganization, sourceUrl)
// checks JSON data with the given guard and only returns the data if its type is correct
export function validateResponse<T>(
  data: unknown,
  isT: (x: unknown) => x is T,
  sourceUrl?: string | null,
): T {
  if (isT(data)) {
    return data
  }

  const legacy: ErrorResponse = {
    title: "Invalid data from API",
    message: `Data: ${JSON.stringify(data, undefined, 2)}`,
    source: sourceUrl ?? null,
    data: null,
  }

  throw new AppApiError({
    kind: "client",
    status: 422,
    title: legacy.title,
    userMessage: legacy.message,
    body: legacy,
    url: sourceUrl ?? null,
  })
}

/** Usage: validateResponse(response, isArray(isOrganization)) */
export function isArray<T>(isT: (x: unknown) => x is T): (x: unknown) => x is Array<T> {
  // ts doesn't understand this so we need the explicit cast
  return ((x) => Array.isArray(x) && x.every((i) => isT(i))) as (x: unknown) => x is Array<T>
}

export function isString(x: unknown): x is string {
  return typeof x === "string"
}

export function isNumber(x: unknown): x is number {
  return typeof x === "number"
}

export function isNull(x: unknown): x is null {
  return x === null
}

export function isUuid(x: unknown): x is string {
  if (!isString(x)) {
    return false
  }
  return UUID_REGEX.test(x)
}

export function isBoolean(x: unknown): x is boolean {
  return typeof x === "boolean"
}

/**
 * Used when the rust type is a HashMap. Assumes keys are strings.
 *
 * Usage: `validateResponse(response, isObjectMap(isOrganization))`.
 */
export function isObjectMap<V>(
  valueIsT: (x: unknown) => x is V,
): (x: unknown) => x is { [key: string]: V } {
  const res = (x: unknown) => {
    if (typeof x !== "object" || x === null) {
      return false
    }
    for (const [_key, value] of Object.entries(x)) {
      if (!valueIsT(value)) {
        return false
      }
    }
    return true
  }
  // ts doesn't understand this so we need the explicit cast
  return res as (x: unknown) => x is { [key: string]: V }
}

// usage: validateResponse(response, isUnion(isOrganization, isNull))
export function isUnion<T, U>(
  isT: (x: unknown) => x is T,
  isU: (x: unknown) => x is U,
): (x: unknown) => x is T | U {
  // ts doesn't understand this so we need the explicit cast
  return ((x) => isT(x) || isU(x)) as (x: unknown) => x is T | U
}
