import { test } from "@playwright/test"

/**
 * Owns student numbers `9000012xx`. Needs a module on a graded scale so "3 to 4" is expressible.
 */
test.fixme("Raising a registered grade starts a new attempt and supersedes the old one", () => {
  // Waiting on PR 3's grade-improvement resubmit. The seeded replaced-attempt pair already covers how
  // a chain renders; what is missing is the statement that creates one.
})

test.fixme("A downward or equal regrade resubmits nothing", () => {
  // Waiting on PR 3's grade-improvement resubmit. An implementation that resubmits on any change
  // passes every other case here while getting this one badly wrong.
})
