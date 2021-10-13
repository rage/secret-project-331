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
  await expect(page).toHaveURL(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Advanced course instance management Manage >> :nth-match(a, 2)

  await Promise.all([
    page.waitForNavigation(),
    page.click("text=Advanced course instance management Manage >> :nth-match(a, 2)"),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "initial-course-management-page",
    waitForThisToBeVisibleAndStable: "text=Course instances",
    page,
  })

  await Promise.all([page.waitForNavigation(), page.click("text=New course instance")])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/new-course-instance",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "new-course-instance-form",
    waitForThisToBeVisibleAndStable: "text=New course instance",
    page,
  })

  await page.fill("#name", "some name")
  await page.fill("#description", "some description")
  await page.fill("#teacher-name", "some teacher")
  await page.fill("#teacher-email", "teacher@example.com")
  await page.fill("#support-email", "support@example.com")
  await Promise.all([page.waitForNavigation(), page.click("text=Submit")])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-management-page-with-new-instance",
    waitForThisToBeVisibleAndStable: "text=New course instance",
    page,
  })

  // Click text=Default Manage Manage emails Export points >> a
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=Default Manage Manage emails Export points >> a"),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/course-instances/211556f5-7793-5705-ac63-b84465916da5",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "initial-management-page",
    waitForThisToBeVisibleAndStable: "text=Course instance default",
    page,
  })

  // Click text=Edit contact details
  await page.click("text=Edit")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "initial-management-page-editing",
    waitForThisToBeVisibleAndStable: "text=Save",
    page,
  })

  await page.fill('[id="name"]', "new name")
  await page.fill('[id="description"]', "new description")
  await page.fill('[id="support-email"]', "newsupport@example.com")
  await page.fill('[id="teacher-name"]', "new teacher")
  await page.fill('[id="teacher-email"]', "newteacher@example.com")

  await page.fill("input:nth-match(input, 6)", "01/01/2000 00:00")
  await page.fill("input:nth-match(input, 7)", "01/01/2099 00:00")

  // Click text=Save
  await page.click("text=Save")

  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && div.textContent.includes("Instance is open and ends at")) {
        div.innerHTML = "Instance is open and ends at yyyy-mm-ddThh:mm:ss.xxxZ"
      }
    }
  })

  await page.click("text=Course instance new name") // scroll to top

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "management-page-after-changes",
    waitForThisToBeVisibleAndStable: "text=Edit",
    page,
  })

  // Click text=Delete course instance
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4' }*/),
    page.click("text=Delete"),
  ])

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-management-page-after-delete",
    waitForThisToBeVisibleAndStable: "text=Course instances",
    page,
  })
})
