import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
import { waitForFooterTranslationsToLoad } from "../utils/waitingUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("glossary test", async ({ page, headless }, testInfo) => {
  test.slow()
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.getByText("Glossary course").click()

  await selectCourseInstanceIfPrompted(page)

  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")

  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage course 'Glossary course'\"] svg").click()

  await page.getByRole("tab", { name: "Other" }).click()
  await Promise.all([page.getByRole("tab", { name: "Glossary" }).click()])

  await page.getByRole("button", { name: "Edit" }).first().click()
  await page.getByText("Cancel").click()

  await page.getByRole("button", { name: "Delete" }).first().click()

  await page.getByText("Deleted").first().waitFor()

  await page.getByPlaceholder("New term").fill("abcd")
  await page.getByPlaceholder("New definition").fill("efgh")

  await page.click(`button:text-is("Save") >> visible=true`)
  await page.locator(`div:text-is("Success")`).waitFor()
  // The save button reloads the data in the background and that might make the added-new-term screenshot unstable without the reload.
  await page.reload()
  await page.getByText("efgh").waitFor()
  await waitForFooterTranslationsToLoad(page)

  await page.getByRole("button", { name: "Edit" }).first().click()

  // Fill [placeholder="updated term"]
  await page.getByPlaceholder("Updated term").fill("ABCD")

  // Fill text=efgh
  await page.getByPlaceholder("Updated definition").fill("EFGH")

  await page.click(':nth-match(:text("Save"), 2)')

  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")
  await page.getByText("Give feedback").waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "final-glossary-page",
    waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Glossary" })],
    clearNotifications: true,
  })
})
