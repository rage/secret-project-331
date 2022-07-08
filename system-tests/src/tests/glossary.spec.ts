import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  // Click text=Glossary course
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/glossary-course' }*/),
    page.click("text=Glossary course"),
  ])

  await selectCourseInstanceIfPrompted(page)

  // Go to http://project-331.local/org/uh-cs/courses/glossary-course/glossary
  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "initial-glossary-page",
    waitForThisToBeVisibleAndStable: "text=Glossary",
  })

  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  // Click [aria-label="Manage course 'Glossary course'"] svg
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/c218ca00-dbde-4b0c-ab98-4f075c49425a' }*/),
    page.click("[aria-label=\"Manage course 'Glossary course'\"] svg"),
  ])

  // Click text=Manage glossary

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/c218ca00-dbde-4b0c-ab98-4f075c49425a/glossary' }*/),
    page.click("text=Glossary"),
  ])

  await page.click("text=Edit")
  await page.click("text=Cancel")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "initial-glossary-management-page",
    waitForThisToBeVisibleAndStable: "text=Manage glossary",
  })

  // Click text=Delete
  await page.click("text=Delete")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "deleted-term",
    waitForThisToBeVisibleAndStable: "text=Deleted",
  })

  await page.fill('[placeholder="New term"]', "abcd")
  await page.fill('textarea[name="New definition"]', "efgh")

  // Click button:text-is("Save")
  await page.click(`button:text-is("Save") >> visible=true`)
  await page.locator(`div:text-is("Success")`).waitFor()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "added-new-term",
    waitForThisToBeVisibleAndStable: `div:text-is("Success")`,
    scrollToYCoordinate: 538,
  })

  // Click text=Edit
  await page.click("text=Edit")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "editing-term",
    waitForThisToBeVisibleAndStable: "text=updated term",
    clearNotifications: true,
  })

  // Fill [placeholder="updated term"]
  await page.fill('[label="Updated term"]', "ABCD")

  // Fill text=efgh
  await page.fill('[label="Updated definition"]', "EFGH")

  // Click text=updated termupdated definitionEFGHSaveCancel >> button
  await page.click(':nth-match(:text("Save"), 2)')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "edited-term",
    waitForThisToBeVisibleAndStable: `div:text-is("Success")`,
  })

  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "final-glossary-page",
    waitForThisToBeVisibleAndStable: "text=Glossary",
    clearNotifications: true,
  })
})
