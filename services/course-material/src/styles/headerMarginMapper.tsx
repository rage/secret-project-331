/* eslint-disable i18next/no-literal-string */
const headingLevelMap: { [level: number]: string } = {
  1: "2.5rem",
  2: "2rem",
  3: "1.5rem",
  4: "1.25rem",
  5: "1rem",
  6: "0.75rem",
}

export const marginTopHeadingMapper = (level: number): string => {
  return headingLevelMap[level]
}
