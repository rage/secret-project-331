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

/**
 * Returns `obj` when `condition` is truthy, otherwise `{}`, for spreading a group of keys into an
 * object only when a condition holds. Keys become optional in the result, with `null` and
 * `undefined` dropped from their types (a truthy `condition` implies the values are present).
 *
 * Use instead of `...(condition ? { key } : {})` spreads: `...includeIf(condition, { key })`. Keep
 * member access in `obj` optionally-chained (`x?.y`), since `obj` is built before the check.
 */
export function includeIf<T extends object>(condition: unknown, obj: T): IncludeIf<T> {
  return (condition ? obj : {}) as IncludeIf<T>
}

type IncludeIf<T> = { [K in keyof T]?: NonNullable<T[K]> }
