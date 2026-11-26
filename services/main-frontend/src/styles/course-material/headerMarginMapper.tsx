"use client"

/* oxlint-disable i18next/no-literal-string */
const headingLevelMap: Record<number, string> = {
  1: "2.5rem",
  2: "2rem",
  3: "1.5rem",
  4: "1.25rem",
  5: "1rem",
  6: "0.75rem",
}

export const marginTopHeadingMapper = (level: number): string | undefined => {
  // preserves prior runtime behavior (returns the mapped value, or undefined for unknown levels)
  return headingLevelMap[level]
}
