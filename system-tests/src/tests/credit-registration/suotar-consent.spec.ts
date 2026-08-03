import { test } from "@playwright/test"

/** Owns student numbers `9000007xx`. */
test.fixme("Withholding consent makes zero Suotar calls", () => {
  // Waiting on the consent dialog. Assert against the mock's call log.
})

test.fixme("Withdrawing consent mid-flight abandons the in-flight row and stops polling", () => {
  // Waiting on the withdrawal fan-out. An already-sent item may still land in Sisu, so the
  // row must be abandoned rather than failed: it belongs in no count, alert or stuck query.
})
