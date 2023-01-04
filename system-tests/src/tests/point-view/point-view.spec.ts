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
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/point-view-for-teachers' }*/),
    page.click("text=Point view for teachers"),
  ])

  await page.click("text=default")

  await selectCourseInstanceIfPrompted(page)

  await page.click("text=Start course")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/point-view-for-teachers/chapter-1' }*/),
    page.click("text=The Basics"),
  ])

  await Promise.all([page.waitForNavigation(), page.click("text=Page One")])

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )
  if (!frame) {
    throw new Error("Could not find frame")
  }
  await frame.click("text=b")

  await page.click("text=Submit")

  await page.goto("http://project-331.local/")

  await page.click("text=University of Helsinki, Department of Computer Science")
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.click("[aria-label=\"Manage course 'Point view for teachers'\"] svg")
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

  await page.click("text=user_4@example.com")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "point-view-bottom",
    waitForTheseToBeVisibleAndStable: [page.locator("text=user_4@example.com")],
    screenshotTarget: page,
  })
})
