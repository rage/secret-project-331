export function joinAriaDescribedBy(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter((v): v is string => typeof v === "string" && v.length > 0).join(" ")
  return joined.length > 0 ? joined : undefined
}

/** Required state is announced via aria-required; native `required` adds a second browser message. */
export const ARIA_VALIDATION = "aria" as const
