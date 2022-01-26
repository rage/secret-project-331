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

  // Click text=Manage
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92' }*/),
    page.click("text=Manage"),
  ])

  // Click text=Manage permissions
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92/permissions' }*/),
    page.click("text=Manage permissions"),
  ])

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "initial-permission-management-page",
    waitForThisToBeVisibleAndStable: ["text=Roles for organization"],
  })

  // Click [aria-label="Edit role"]
  await page.click('[aria-label="Edit role"]')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "editing-permission",
    waitForThisToBeVisibleAndStable: ["#editing-role"],
  })

  // Select Reviewer
  await page.selectOption(
    "text=teacher@example.comAdminAssistantReviewerTeacher >> select",
    "Reviewer",
  )

  // Click [aria-label="Save edited role"]
  await page.click('[aria-label="Save edited role"]')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "edited-permission",
    waitForThisToBeVisibleAndStable: ['td:text("Reviewer")'],
  })

  // Click [aria-label="Remove role"]
  await page.click('[aria-label="Remove role"]')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "removed-permission",
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

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "added-permission",
    waitForThisToBeVisibleAndStable: ["text=teacher@example.com"],
  })

  // Click [aria-label="Sort by email"]
  await page.click('[aria-label="Sort by email"]')
  await expect(page).toHaveURL(
    "http://project-331.local/manage/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92/permissions?sort=email",
  )

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "sorted-by-email",
  })

  // Click [aria-label="Sort by role"]
  await page.click('[aria-label="Sort by role"]')
  await expect(page).toHaveURL(
    "http://project-331.local/manage/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92/permissions?sort=role",
  )

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "sorted-by-role",
  })
})
