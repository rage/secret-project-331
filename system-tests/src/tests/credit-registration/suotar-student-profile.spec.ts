import { test } from "@playwright/test"

/**
 * Owns student numbers `9000016xx`. The tab is hidden while the student has no course on the
 * new flow, which is everyone for now.
 */
test.fixme("All cards render for a student with data, including a superseded attempt as history", () => {
  // Waiting on the tab.
})

test.fixme("A student with nothing linked sees explanatory copy, not three empty cards", () => {
  // Waiting on the tab.
})

test.fixme("Consent can be given and withdrawn here, and the copy says registered credits stay in Sisu", () => {
  // Waiting on the tab.
})

test.fixme("A student cannot read another student's profile data", () => {
  // Waiting on the tab. Request it directly and assert it is refused.
})
