import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test("Research consent form is visible on login, if not yet answered", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "Log in" }).click()
  await page.click(`label:has-text("Email")`)
  await page.fill(`label:has-text("Email")`, "student-without-research-consent@example.com")

  await page.click(`label:has-text("Password")`)
  await page.fill(`label:has-text("Password")`, "student-without-research-consent")
  await page.locator("id=login-button").click()
  await expect(page.locator("text=Regarding research done on courses")).toBeVisible()

  await page
    .getByLabel(
      "I want to participate in the educational research. By choosing this, you help both current and future students.",
    )
    .check()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "research-consent-form",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Regarding research done on courses")],
  })
  await page.getByRole("button", { name: "Save" }).click()

  //Login again and check research consent form doesn't show again when already answered.
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "Log out" }).click()
  await page.getByRole("button", { name: "Log in" }).click()

  await page.click(`label:has-text("Email")`)
  await page.fill(`label:has-text("Email")`, "student-without-research-consent@example.com")

  await page.click(`label:has-text("Password")`)
  await page.fill(`label:has-text("Password")`, "student-without-research-consent")
  await page.locator("id=login-button").click()
  await expect(page.locator("text=Organizations")).toBeVisible()
})
