import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ headless, page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course 'Permission management'\"] svg").click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92/permissions' }*/),
    page.locator("text=Permissions").click(),
  ])

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "initial-permission-management-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Roles for course")],
  })

  await page.click('[placeholder="Enter email"]')

  // Fill [placeholder="Enter email"]
  await page.fill('[placeholder="Enter email"]', "teacher@example.com")

  await page.locator("text=RoleAdminAssistantReviewerTeacher >> div").click()

  // Select Admin
  await page.selectOption("select", "Admin")

  await page.locator("text=Add user").click()

  await page.click('[placeholder="Enter email"]')

  // Fill [placeholder="Enter email"]
  await page.fill('[placeholder="Enter email"]', "admin@example.com")

  await page.locator("text=RoleAdminAssistantReviewerTeacher >> div").click()

  // Select Admin
  await page.selectOption("select", "Teacher")

  await page.locator("text=Add user").click()

  await page.click('[aria-label="Sort by email"]')
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/a2002fc3-2c87-4aae-a5e5-9d14617aad2b/permissions?sort=email",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "sorted-by-email",
    clearNotifications: true,
  })

  await page.click('[aria-label="Sort by role"]')
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/a2002fc3-2c87-4aae-a5e5-9d14617aad2b/permissions?sort=role",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "sorted-by-role",
  })

  await page.click('[aria-label="Edit role"]')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "editing-permission",
    waitForTheseToBeVisibleAndStable: [page.getByText("teacher@example.com").first()],
  })

  // Select Reviewer
  await page.selectOption(
    "text=teacher@example.comAdminAssistantReviewerTeacher >> select",
    "Reviewer",
  )

  await page.click('[aria-label="Save edited role"]')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "edited-permission",
    waitForTheseToBeVisibleAndStable: [page.locator('text="Success"')],
    clearNotifications: false,
  })

  await page.click('[aria-label="Remove role"]')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "removed-permission",
    waitForTheseToBeVisibleAndStable: [page.locator('text="Success"')],
  })
})
