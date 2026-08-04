import type { TFunction } from "i18next"

/** Reads a map keyed more narrowly than the runtime value: a backend enum may gain variants. */
export function widenedLookup<V>(map: Record<string, V>, key: string): V | undefined {
  return (map as Record<string, V | undefined>)[key]
}

/** `t`'s type pins the key to known translation keys, which a generic lookup cannot satisfy. */
type AnyKeyTFunction = (key: string, options?: Record<string, unknown>) => string

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
