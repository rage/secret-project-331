import { expect, test } from "@playwright/test"

import { downloadToString } from "../../utils/download"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page
    .locator("[aria-label=\"Manage course 'Advanced course instance management'\"] svg")
    .click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "initial-course-management-page",
    waitForTheseToBeVisibleAndStable: [page.getByRole("tab", { name: "Course instances" })],
    screenshotTarget: page,
  })

  await page.locator("text=Export submissions (exercise tasks) as CSV").scrollIntoViewIfNeeded()

  const [submissionsDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export submissions (exercise tasks) as CSV" }).click(),
  ])

  const submissionsCsvContents = await downloadToString(submissionsDownload)
  expect(submissionsCsvContents).toContain(
    "exercise_slide_submission_id,id,user_id,created_at,course_instance_id,exercise_id,exercise_task_id,score_given,data_json",
  )
  expect(submissionsCsvContents).toContain("e10557bd-9835-51b4-b0d9-f1d9689ebc8d")
  expect(submissionsCsvContents).toContain(
    "bcd944f3-bba5-53a4-a0c5-b20d496607ee,00e249d8-345f-4eff-aedb-7bdc4c44c1d5",
  )
  expect(submissionsCsvContents).toContain(
    '211556f5-7793-5705-ac63-b84465916da5,239f666e-2982-5c40-9e94-a72324cf3242,cbc5746d-c9c6-584c-9f46-0d9e8d948dd0,0.8,"""d9b37119-70ed-5aab-be81-f2b1c90c8f3d"""',
  )

  const [usersDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export user details as CSV" }).click(),
  ])

  const usersCsvContents = await downloadToString(usersDownload)
  expect(usersCsvContents).toContain("user_id,created_at,updated_at,first_name,last_name,email")
  expect(usersCsvContents).toContain("3524d694-7fa8-4e73-aa1a-de9a20fd514b,")
  expect(usersCsvContents).toContain(",User4,,user_4@example.com")

  await Promise.all([page.getByRole("tab", { name: "Course instances" }).click()])
  await page.click(`:nth-match(button:text("New"):below(:text("All course instances")), 1)`)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
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
  await page.locator("text=Submit").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/course-instances",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-management-page-with-new-instance",
    waitForTheseToBeVisibleAndStable: [page.getByText("Success").first()],
    screenshotTarget: page,
  })

  await page.click("text=Default Manage >> a")
  await expect(page).toHaveURL(
    "http://project-331.local/manage/course-instances/211556f5-7793-5705-ac63-b84465916da5",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "initial-management-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Course instance default")],
    screenshotTarget: page,
    clearNotifications: true,
  })

  await page.getByRole("button", { name: "Edit" }).first().click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "initial-management-page-editing",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Name").first()],
    screenshotTarget: page,
  })

  await page.fill("#name", "new name")
  await page.fill("#description", "new description")
  await page.fill("#supportEmail", "newsupport@example.com")
  await page.fill("#teacherName", "new teacher")
  await page.fill("#teacherEmail", "newteacher@example.com")
  await page.fill("text=Opening time", "2000-01-01T00:00")
  await page.fill("text=Closing time", "2098-01-01T23:59")

  await page.locator("text=Submit").click()

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
    testInfo,
    snapshotName: "management-page-after-changes",
    waitForTheseToBeVisibleAndStable: [page.getByText("newsupport@example.com").first()],
    screenshotTarget: page,
    clearNotifications: true,
  })

  await page.locator("text=Delete").click()

  await page.getByRole("tab", { name: "Course instances" }).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-management-page-after-delete",
    waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "All course instances" })],
    screenshotTarget: page,
    clearNotifications: true,
  })
})
