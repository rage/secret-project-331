export function joinAriaDescribedBy(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter((v): v is string => typeof v === "string" && v.length > 0).join(" ")
  return joined.length > 0 ? joined : undefined
}
