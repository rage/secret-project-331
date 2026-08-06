import { test } from "@playwright/test"

/** Owns student numbers `9000004xx`. */
test.fixme("A Sisu timeout never re-imports, and recovers through verification only", () => {
  // Waiting on the import phase. A double submission puts two attainments on a real
  // transcript and cannot be undone: prove exactly one submit call was made for the row.
})

test.fixme("Each import error code lands the row in its documented state", () => {
  // Waiting on the import phase.
})
