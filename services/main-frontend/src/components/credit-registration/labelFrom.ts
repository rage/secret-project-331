import type { TFunction } from "i18next"

/** Reads a map keyed more narrowly than the runtime value: a backend enum may gain variants. */
export function widenedLookup<V>(map: Record<string, V>, key: string): V | undefined {
  return (map as Record<string, V | undefined>)[key]
}

/** `t`'s type pins the key to known translation keys, which a generic lookup cannot satisfy. */
type AnyKeyTFunction = (key: string, options?: Record<string, unknown>) => string

/**
 * Translates a key a lookup produced rather than a literal.
 *
 * For the common case — one map from an enum value to a key — use `labelFrom`, which does the
 * lookup and the fallback too.
 */
export function translateKey(t: TFunction, key: string, options?: Record<string, unknown>): string {
  const translate = t as unknown as AnyKeyTFunction
  return options === undefined ? translate(key) : translate(key, options)
}

export function labelFrom<V extends string>(
  t: TFunction,
  map: Record<string, V>,
  key: string,
  fallbackKey: V,
  options?: Record<string, unknown>,
): string {
  return translateKey(t, widenedLookup(map, key) ?? fallbackKey, options)
}
