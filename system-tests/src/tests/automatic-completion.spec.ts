import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import { ChapterSelector } from "../utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
import { runMaterializeTick } from "../utils/suotarControl"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Registers automatic completion", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.getByText("Automatic Completions").click()

  await selectCourseInstanceIfPrompted(page)

  const chapterSelector = new ChapterSelector(page)
  await chapterSelector.clickChapter(1)

  await page.getByText("1Page One").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/automatic-completions/chapter-1/page-1",
  )

  await page.frameLocator("iframe").getByText("b").click()

  await page.locator('button:has-text("Submit")').click()
  // Have to wait until the submit is done
  await page.getByText(`Good job!`).waitFor()

  await page.getByRole("link", { name: "Automatic Completions" }).click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/automatic-completions")
  await page.getByText("Congratulations!").waitFor()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "automatic-completion-congratulations-card",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Congratulations!"),
      page.getByText("You have successfully completed the course!"),
    ],
    // reset to top before beforeScreenshot so that scrollIntoViewIfNeeded lands in a consistent spot
    scrollToYCoordinate: 0,
    beforeScreenshot: () => page.getByText("Congratulations!").scrollIntoViewIfNeeded(),
  })

  // Only the completed module's CTA is an enabled link; others render as disabled buttons
  await page.getByRole("link", { name: "Register completion", exact: true }).click()
  // The background worker creates the registration on its own schedule, so the page shows it
  // either before or after; ticking now pins the screenshot to after.
  await runMaterializeTick(page.request, {
    courseSlug: "automatic-completions",
    userEmail: "teacher@example.com",
  })
  await page.getByText("Link your student number").waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "automatic-completion-registration-page",
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("heading", { name: "Register completion" }),
      page.getByRole("button", { name: "Start" }),
    ],
  })
})
