import { test } from "@playwright/test"

// This file exists so that `npm run create-login-states` works
test("Successfully created login states", async ({ browserName }) => {
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(browserName !== "webkit", "Skip")
})
