import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/glossary-course' }*/),
    page.click("text=Glossary course"),
  ])

  await selectCourseInstanceIfPrompted(page)

  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "initial-glossary-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Glossary")],
  })

  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/c218ca00-dbde-4b0c-ab98-4f075c49425a' }*/),
    page.click("[aria-label=\"Manage course 'Glossary course'\"] svg"),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/c218ca00-dbde-4b0c-ab98-4f075c49425a/glossary' }*/),
    page.click("text=Glossary"),
  ])

  await page.click("text=Edit")
  await page.click("text=Cancel")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "initial-glossary-management-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Manage glossary")],
  })

  await page.click("text=Delete")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "deleted-term",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Deleted")],
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
    snapshotName: "added-new-term",
    waitForTheseToBeVisibleAndStable: [page.locator("text=efgh")],
    scrollToYCoordinate: 538,
  })

  await page.click("text=Edit")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
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
    snapshotName: "edited-term",
    waitForTheseToBeVisibleAndStable: [page.locator(`div:text-is("Success")`)],
  })

  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")
  await page.locator("text=Give feedback").waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "final-glossary-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Glossary")],
    clearNotifications: true,
  })
})
