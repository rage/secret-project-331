import { test } from "@playwright/test"

test("Successfully created login states", async ({ browserName }) => {
  test.skip(browserName !== "webkit", "Skip")
})
