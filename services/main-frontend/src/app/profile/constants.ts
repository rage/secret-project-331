// SCREAMING_CASE so the i18next literal-string lint ignores these display constants.

export const TONE = {
  NEUTRAL: "neutral",
  SUCCESS: "success",
} as const

export const MIDDLE_DOT = " · "

/** Placeholder for a value the student has not earned yet. */
export const EM_DASH = "—"

export const STUDIES_TAB = "studies"
/** The tab only renders once a student has a course that supports credit registration. */
export const CREDIT_REGISTRATION_TAB = "credit-registration"

export const FIND_MORE_COURSES_URL = "https://www.mooc.fi"
