import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "@/utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Points view works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.getByText("Point view for teachers").click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("Start course").click()

  await page.getByText("The Basics").click()

  await page.getByText("Page One").first().click()

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
  await frame.getByText("b").click()

  await page.getByText("Submit").click()
  await page.getByRole("button", { name: "try again" }).waitFor()

  await page.goto("http://project-331.local/organizations")

  await page.getByText("University of Helsinki, Department of Computer Science").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course 'Point view for teachers'\"] svg").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/b4cb334c-11d6-4e93-8f3d-849c4abfcd67",
  )

  await page.getByRole("tab", { name: "Course instances" }).click()

  await page.getByText("View points").nth(1).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "point-view-top",
    waitForTheseToBeVisibleAndStable: [page.getByText("Another chapter").first()],
    screenshotTarget: page,
  })

  await page.getByText("user_4@example.com").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "point-view-bottom",
    waitForTheseToBeVisibleAndStable: [page.getByText("User id").first()],
    screenshotTarget: page,
  })
})
