import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
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

  // Click text=Advanced course instance management Manage >> :nth-match(a, 2)

  await Promise.all([
    page.waitForNavigation(),
    await page.click("[aria-label=\"Manage course 'Advanced course instance management'\"] svg"),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "initial-course-management-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Course instances")],
    screenshotTarget: page,
  })

  await Promise.all([page.waitForNavigation(), page.click("text=Course instances")])
  await page.click(`:nth-match(button:text("New"):below(:text("All course instances")), 1)`)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "new-course-instance-form",
    waitForTheseToBeVisibleAndStable: [page.locator("text=New course instance")],
    screenshotTarget: page,
  })

  await page.fill("#name", "some name")
  await page.fill("#description", "some description")
  await page.fill("#teacherName", "some teacher")
  await page.fill("#teacherEmail", "teacher@example.com")
  await page.fill("#supportEmail", "support@example.com")
  await page.fill("text=Opening time", "2000-01-01T00:00")
  await page.fill("text=Closing time", "2099-01-01T23:59")
  await page.click("text=Submit")
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/course-instances",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-management-page-with-new-instance",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Success")],
    screenshotTarget: page,
  })

  // Click text=Default Manage Manage emails View Points Export points >> a
  await Promise.all([
    page.waitForNavigation(),
    page.click(
      "text=Default Manage Manage emails Manage permissions View Completions View Points Export points >> a",
    ),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/course-instances/211556f5-7793-5705-ac63-b84465916da5",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "initial-management-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Course instance default")],
    screenshotTarget: page,
    clearNotifications: true,
  })

  // Click text=Edit contact details
  await page.click("text=Edit")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "initial-management-page-editing",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Submit")],
    screenshotTarget: page,
  })

  await page.fill("#name", "new name")
  await page.fill("#description", "new description")
  await page.fill("#supportEmail", "newsupport@example.com")
  await page.fill("#teacherName", "new teacher")
  await page.fill("#teacherEmail", "newteacher@example.com")
  await page.fill("text=Opening time", "2000-01-01T00:00")
  await page.fill("text=Closing time", "2098-01-01T23:59")

  await page.click("text=Submit")

  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })

  await page.waitForSelector("text=Instance is open and ends at")

  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of Array.from(divs)) {
      if (
        div.children.length === 0 &&
        div.textContent &&
        div.textContent.includes("Instance is open and ends at")
      ) {
        div.innerHTML = "Instance is open and ends at yyyy-mm-ddThh:mm:ss.xxxZ"
      }
    }
  })

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "management-page-after-changes",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Success")],
    screenshotTarget: page,
  })

  // Click text=Delete course instance
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4' }*/),
    page.click("text=Delete"),
  ])

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-management-page-after-delete",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Course instances")],
    screenshotTarget: page,
  })
})
