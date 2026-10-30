/** Heading levels the aside's title may use; course material renders anything else as h4. */
export const ASIDE_HEADING_LEVELS = [2, 3, 4, 5, 6]

export const DEFAULT_ASIDE_HEADING_LEVEL = 4

/** The level the title renders at, for stored values that are missing or out of range. */
export const resolveAsideHeadingLevel = (headingLevel: unknown): number =>
  typeof headingLevel === "number" && ASIDE_HEADING_LEVELS.includes(headingLevel)
    ? headingLevel
    : DEFAULT_ASIDE_HEADING_LEVEL
