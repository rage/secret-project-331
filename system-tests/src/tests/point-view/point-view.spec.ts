import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page, headless }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/point-view-for-teachers' }*/),
    page.locator("text=Point view for teachers").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await page.locator("text=Start course").click()

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/point-view-for-teachers/chapter-1' }*/),
    page.locator("text=The Basics").click(),
  ])

  await Promise.all([page.waitForNavigation(), page.locator("text=Page One").first().click()])

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )
  if (!frame) {
    throw new Error("Could not find frame")
  }
  await frame.click("text=b")

  await page.locator("text=Submit").click()

  await page.goto("http://project-331.local/")

  await page.locator("text=University of Helsinki, Department of Computer Science").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course 'Point view for teachers'\"] svg").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/b4cb334c-11d6-4e93-8f3d-849c4abfcd67",
  )

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/course-instances/1544bf21-240a-56c4-a391-9b0621051fa6/points' }*/),
    page.locator("text=View points").nth(1).click(),
  ])

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "point-view-top",
    waitForTheseToBeVisibleAndStable: [page.locator("text=TOTAL POINT DASHBOARD")],
    screenshotTarget: page,
  })

  await page.locator("text=user_4@example.com").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "point-view-bottom",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Teacher Example")],
    screenshotTarget: page,
  })
})
