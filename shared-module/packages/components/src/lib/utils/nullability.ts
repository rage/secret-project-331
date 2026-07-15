/**
 * `obj` with every `undefined`-valued key dropped, and those keys made optional in the result type.
 *
 * Under `exactOptionalPropertyTypes` an optional prop `key?: T` rejects an explicit `undefined`, so
 * passing a maybe-undefined value straight through fails to type-check. Use this instead of chained
 * `...(x !== undefined ? { x } : {})` spreads: `omitUndefined({ a, b, c })`.
 *
 * `components` cannot depend on `common`, so this mirrors `common`'s `utils/nullability` helper.
 */
export function omitUndefined<T extends object>(obj: T): OmitUndefined<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result as OmitUndefined<T>
}

type OmitUndefined<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>
} & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
}
