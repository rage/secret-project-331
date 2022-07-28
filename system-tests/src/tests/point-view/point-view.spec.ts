import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Point view for teachers
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/point-view-for-teachers' }*/),
    page.click("text=Point view for teachers"),
  ])

  // Click text=Default
  await page.click("text=Default")

  // Click button:has-text("Continue")
  await selectCourseInstanceIfPrompted(page)

  // Click text=Start course
  await page.click("text=Start course")

  // Click text=The Basics
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/point-view-for-teachers/chapter-1' }*/),
    page.click("text=The Basics"),
  ])

  // Click text=Page One
  await Promise.all([page.waitForNavigation(), page.click("text=Page One")])

  // Click text=b
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )
  if (!frame) {
    throw new Error("Could not find frame")
  }
  await frame.click("text=b")

  // Click text=Submit
  await page.click("text=Submit")

  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await page.click("text=University of Helsinki, Department of Computer Science")
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Point view for teachers Manage >> :nth-match(a, 2)
  await page.click("[aria-label=\"Manage course 'Point view for teachers'\"] svg")
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/b4cb334c-11d6-4e93-8f3d-849c4abfcd67",
  )

  // Click text=View points
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/course-instances/1544bf21-240a-56c4-a391-9b0621051fa6/points' }*/),
    page.click("text=View points"),
  ])

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "point-view-top",
    waitForThisToBeVisibleAndStable: "text=TOTAL POINT DASHBOARD",
    page,
  })

  await page.click("text=user_4@example.com")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "point-view-bottom",
    waitForThisToBeVisibleAndStable: "text=user_4@example.com",
    page,
  })
})
