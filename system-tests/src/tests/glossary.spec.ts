import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("glossary test", async ({ page, headless }, testInfo) => {
  test.slow()
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("text=Glossary course").click()

  await selectCourseInstanceIfPrompted(page)

  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "initial-glossary-page",
    waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Glossary" })],
  })

  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage course 'Glossary course'\"] svg").click()

  await Promise.all([page.getByRole("tab", { name: "Glossary" }).click()])

  await page.getByRole("button", { name: "Edit" }).first().click()
  await page.locator("text=Cancel").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "initial-glossary-management-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Manage glossary")],
  })

  await page.getByRole("button", { name: "Delete" }).first().click()

  await page.getByText("Deleted").first().waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "deleted-term",
    waitForTheseToBeGone: [page.getByText("Computer science is an essential")],
    clearNotifications: true,
  })

  await page.fill('[placeholder="New term"]', "abcd")
  await page.fill('textarea[name="New definition"]', "efgh")

  await page.click(`button:text-is("Save") >> visible=true`)
  await page.locator(`div:text-is("Success")`).waitFor()
  // The save button reloads the data in the background and that might make the added-new-term screenshot unstable without the reload.
  await page.reload()
  await page.locator("text=efgh").waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "added-new-term",
    waitForTheseToBeVisibleAndStable: [page.locator("text=efgh")],
    scrollToYCoordinate: 538,
  })

  await page.getByRole("button", { name: "Edit" }).first().click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "editing-term",
    waitForTheseToBeVisibleAndStable: [page.locator("text=updated term")],
    clearNotifications: true,
  })

  // Fill [placeholder="updated term"]
  await page.fill('[label="Updated term"]', "ABCD")

  // Fill text=efgh
  await page.fill('[label="Updated definition"]', "EFGH")

  await page.click(':nth-match(:text("Save"), 2)')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "edited-term",
    waitForTheseToBeVisibleAndStable: [page.locator(`text=EFGH`)],
    clearNotifications: true,
  })

  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")
  await page.locator("text=Give feedback").waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "final-glossary-page",
    waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Glossary" })],
    clearNotifications: true,
  })
})
