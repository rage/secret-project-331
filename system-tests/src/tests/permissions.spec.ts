import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.click("[aria-label=\"Manage course 'Permission management'\"] svg"),
  ])

  // Click text=Manage permissions
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92/permissions' }*/),
    page.click("text=Permissions"),
  ])

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "initial-permission-management-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Roles for course")],
  })

  // Click [placeholder="Enter email"]
  await page.click('[placeholder="Enter email"]')

  // Fill [placeholder="Enter email"]
  await page.fill('[placeholder="Enter email"]', "teacher@example.com")

  // Click text=RoleAdminAssistantReviewerTeacher >> div
  await page.click("text=RoleAdminAssistantReviewerTeacher >> div")

  // Select Admin
  await page.selectOption("select", "Admin")

  // Click text=Add user
  await page.click("text=Add user")

  // Click [placeholder="Enter email"]
  await page.click('[placeholder="Enter email"]')

  // Fill [placeholder="Enter email"]
  await page.fill('[placeholder="Enter email"]', "admin@example.com")

  // Click text=RoleAdminAssistantReviewerTeacher >> div
  await page.click("text=RoleAdminAssistantReviewerTeacher >> div")

  // Select Admin
  await page.selectOption("select", "Teacher")

  // Click text=Add user
  await page.click("text=Add user")

  // Click [aria-label="Sort by email"]
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

  // Click [aria-label="Sort by role"]
  await page.click('[aria-label="Sort by role"]')
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/a2002fc3-2c87-4aae-a5e5-9d14617aad2b/permissions?sort=role",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "sorted-by-role",
  })

  // Click [aria-label="Edit role"]
  await page.click('[aria-label="Edit role"]')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "editing-permission",
    waitForTheseToBeVisibleAndStable: [page.locator("#editing-role")],
  })

  // Select Reviewer
  await page.selectOption(
    "text=teacher@example.comAdminAssistantReviewerTeacher >> select",
    "Reviewer",
  )

  // Click [aria-label="Save edited role"]
  await page.click('[aria-label="Save edited role"]')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "edited-permission",
    waitForTheseToBeVisibleAndStable: [page.locator('text="Success"')],
    clearNotifications: true,
  })

  // Click [aria-label="Remove role"]
  await page.click('[aria-label="Remove role"]')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "removed-permission",
    waitForTheseToBeVisibleAndStable: [page.locator('text="Success"')],
  })
})
