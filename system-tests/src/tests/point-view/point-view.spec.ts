import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test.only("test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("text=Point view for teachers").click()

  await selectCourseInstanceIfPrompted(page)

  await page.locator("text=Start course").click()

  await page.locator("text=The Basics").click()

  await page.locator("text=Page One").first().click()

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
  await frame.locator("text=b").click()

  await page.locator("text=Submit").click()
  await page.getByRole("button", { name: "try again" }).waitFor()

  await page.goto("http://project-331.local/")

  await page.locator("text=University of Helsinki, Department of Computer Science").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course 'Point view for teachers'\"] svg").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/b4cb334c-11d6-4e93-8f3d-849c4abfcd67",
  )

  await page.getByRole("tab", { name: "Course instances" }).click()

  await page.locator("text=View points").nth(1).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "point-view-top",
    waitForTheseToBeVisibleAndStable: [page.locator("text=TOTAL POINT DASHBOARD")],
    screenshotTarget: page,
  })

  await page.locator("text=user_4@example.com").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "point-view-bottom",
    waitForTheseToBeVisibleAndStable: [page.getByText("User id").first()],
    screenshotTarget: page,
  })
})
