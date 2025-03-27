import { expect, test } from "@playwright/test"

import { downloadToString } from "../../utils/download"
import { showNextToastsInfinitely, showToastsNormally } from "../../utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Manually adding completions works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course \\'Manual Completions\\'\"] path").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/34f4e7b7-9f55-48a7-95d7-3fc3e89553b5",
  )

  await page.getByRole("tab", { name: "Course instances" }).click()

  await page.locator('text=Default Manage >> [aria-label="View completions"]').click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/course-instances/6e3764c9-f2ad-5fe5-b310-ab73c289842e/completions",
  )

  await page.getByText("Manually add completions").click()

  await page.locator('textarea[name="completions"]').click()
  // Fill textarea[name="completions"]
  await page.locator('textarea[name="completions"]').fill(`user_id,grade
  00e249d8-345f-4eff-aedb-7bdc4c44c1d5,5
  8d7d6c8c-4c31-48ae-8e20-c68fa95c25cc,4
  fbeb9286-3dd8-4896-a6b8-3faffa3fabd6,4
  3524d694-7fa8-4e73-aa1a-de9a20fd514b,3`)

  await page.getByRole("button", { name: "Check" }).click()

  await page
    .locator('div[role="button"]:has-text("Users receiving a completion for the first time (3)")')
    .click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "manual-completion-default-module-preview",
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("button", { name: "Submit" }),
      page.getByText("Users receiving a completion for the first time"),
    ],
    screenshotTarget: page,
    clearNotifications: true,
  })

  await page.locator('button:has-text("Submit")').click()

  await page.getByText(`Completions submitted successfully`).waitFor()

  await page.getByText("Manually add completions").click()

  // Select 57db3a62-d098-489a-8869-0a14efd6fa80
  await page.locator("select").selectOption({ label: "Another module" })

  await page.locator('textarea[name="completions"]').click()
  // Fill textarea[name="completions"]
  await page.locator('textarea[name="completions"]').fill(`user_id,grade
  00e249d8-345f-4eff-aedb-7bdc4c44c1d5,pass
  fbeb9286-3dd8-4896-a6b8-3faffa3fabd6,pass`)

  await page.getByRole("button", { name: "Check" }).click()

  await page
    .locator('div[role="button"]:has-text("Users receiving a completion for the first time (2)")')
    .click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "manual-completion-another-module-preview",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Users receiving a completion for the first time"),
      page.getByRole("button", { name: "Submit" }),
    ],
    screenshotTarget: page,
    clearNotifications: true,
  })

  await showNextToastsInfinitely(page)
  await page.locator('button:has-text("Submit")').click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "manual-completion-after-posting-completions",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("User1"),
      page.getByText("User2"),
      page.getByText("User3"),
      page.getByText("User4"),
      page.getByText("Completions submitted successfully."),
    ],
    screenshotTarget: page,
    beforeScreenshot: () => page.getByText("User1").scrollIntoViewIfNeeded(),
  })

  await showToastsNormally(page)

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export completions as CSV" }).click(),
  ])

  const completionsCsvContents = await downloadToString(download)
  expect(completionsCsvContents).toContain(
    "user_id,first_name,last_name,email,default_module_grade,default_module_registered,default_module_completion_date",
  )
  expect(completionsCsvContents).toMatch(
    /[^, ]*-[^, ]*-[^, ]*-[^, ]*-[^, ].*,user_2@example\.com,4,false,[^, ]*T[^, ]*,-,,,-,,/,
  )
  expect(completionsCsvContents).toMatch(
    /[^, ]*-[^, ]*-[^, ]*-[^, ]*-[^, ].*,user_3@example\.com,4,false,[^, ]*T[^, ]*,pass,false,[^, ]*T[^, ]*/,
  )
})
