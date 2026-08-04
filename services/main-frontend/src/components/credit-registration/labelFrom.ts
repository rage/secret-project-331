import type { TFunction } from "i18next"

/**
 * Looks up `key` in a map keyed by a narrower type than the runtime value can be — typically a
 * backend enum that gains a variant after this build shipped — without a cast at each call site.
 */
export function widenedLookup<V>(map: Record<string, V>, key: string): V | undefined {
  return (map as Record<string, V | undefined>)[key]
}

/** A translation call taking any string key, for a `t` whose real type pins the key to the
 *  project's known translation keys — which a key resolved generically, as below, can never be. */
type AnyKeyTFunction = (key: string, options?: Record<string, unknown>) => string

/** `widenedLookup` plus the translation call, falling back to `fallbackKey` for an unmapped key. */
export function labelFrom<V extends string>(
  t: TFunction,
  map: Record<string, V>,
  key: string,
  fallbackKey: V,
  options?: Record<string, unknown>,
): string {
  const resolvedKey = widenedLookup(map, key) ?? fallbackKey
  const translate = t as unknown as AnyKeyTFunction
  return options === undefined ? translate(resolvedKey) : translate(resolvedKey, options)
}
