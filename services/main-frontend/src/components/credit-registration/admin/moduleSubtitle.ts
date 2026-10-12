const stripModulePrefix = (value: string): string => value.replace(/^Module\s+/, "")

/**
 * A module's name and UH course code for the line under a course name. Some configurations name
 * the module after its code ("Module CRS-101"); the code is then left out rather than shown twice.
 */
export const moduleSubtitleParts = (
  moduleName: string | null | undefined,
  courseCode: string | null | undefined,
): string[] => {
  const seen = new Set<string>()
  return [moduleName, courseCode].filter((part): part is string => {
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
