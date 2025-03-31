import { expect, test } from "@playwright/test"

import { hideToasts, showNextToastsInfinitely, showToastsNormally } from "@/utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Managing permissions works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage course 'Permission management'\"] svg").click()

  await page.getByText("Permissions").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "initial-permission-management-page",
    waitForTheseToBeVisibleAndStable: [page.getByText("Roles for course")],
  })

  await page.click('[placeholder="Enter email"]')

  // Fill [placeholder="Enter email"]
  await page.fill('[placeholder="Enter email"]', "teacher@example.com")

  // Select Admin
  await page.selectOption("select", "Admin")

  await page.getByText("Add user").click()

  await page.click('[placeholder="Enter email"]')

  // Fill [placeholder="Enter email"]
  await page.fill('[placeholder="Enter email"]', "admin@example.com")

  // Select Admin
  await page.selectOption("select", "Teacher")

  await page.getByText("Add user").click()

  await page.click('[aria-label="Sort by email"]')
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/a2002fc3-2c87-4aae-a5e5-9d14617aad2b/permissions?sort=email",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
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
    testInfo,
    snapshotName: "sorted-by-role",
  })

  await page.click('[aria-label="Edit role"]')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "editing-permission",
    waitForTheseToBeVisibleAndStable: [page.getByText("teacher@example.com").first()],
  })

  // Select Reviewer
  await page.selectOption(
    "text=teacher@example.comAdminAssistantReviewerTeacher >> select",
    "Reviewer",
  )

  await showNextToastsInfinitely(page)
  await page.click('[aria-label="Save edited role"]')
  await page.getByText("Success").first().waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "edited-permission",
    clearNotifications: false,
  })

  await hideToasts(page)
  await page.click('[aria-label="Remove role"]')
  await page.getByText("Success").first().waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "removed-permission",
  })
  await showToastsNormally(page)
})
