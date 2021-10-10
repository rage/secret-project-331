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
    waitForThisToBeVisibleAndStable: "text=Edit contact details",
    page,
  })

  // Click text=Edit contact details
  await page.click("text=Edit contact details")

  await page.fill('[id="contact email"]', "contact@example.com")
  await page.fill('[id="supervisor name"]', "Admin Example")
  await page.fill('[id="supervisor email"]', "admin@example.org")

  // Click text=Save
  await page.click("text=Save")

  // Click text=Change schedule
  await page.click("text=Change schedule")

  await page.fill("input", "01/01/2000 00:00")
  await page.fill("input:nth-match(input, 2)", "01/01/2099 00:00")

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

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "management-page-after-changes",
    waitForThisToBeVisibleAndStable: "text=Edit contact details",
    page,
  })

  // Click text=Delete course instance
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4' }*/),
    page.click("text=Delete course instance"),
  ])

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-management-page-after-delete",
    waitForThisToBeVisibleAndStable: "text=Course instances",
    page,
  })
})
