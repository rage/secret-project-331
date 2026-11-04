const stripModulePrefix = (value: string): string => value.replace(/^Module\s+/, "")

/**
 * A module's name, UH course code and any mooc.fi tiers for the line under a course name. A module
 * named after its code ("Module CRS-101") shows the code once.
 */
export const moduleSubtitleParts = (
  moduleName: string | null | undefined,
  courseCode: string | null | undefined,
  tiers?: string | null,
): string[] => {
  const seen = new Set<string>()
  return [moduleName, courseCode, tiers].filter((part): part is string => {
    if (!part) {
      return false
    }
    const key = stripModulePrefix(part)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
