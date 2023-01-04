import { expect, test } from "@playwright/test"

import { downloadToString } from "../../utils/download"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click [aria-label="Manage course \'Manual Completions\'"] path
  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course \\'Manual Completions\\'\"] path").click(),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/34f4e7b7-9f55-48a7-95d7-3fc3e89553b5",
  )

  // Click text=Default Manage Manage emails Manage permissions View completions View points Exp >> [aria-label="View completions"]
  await page
    .locator(
      'text=Default Manage Manage emails Manage permissions View completions View points Exp >> [aria-label="View completions"]',
    )
    .click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/course-instances/6e3764c9-f2ad-5fe5-b310-ab73c289842e/completions",
  )

  // Click text=Manually add completions
  await page.locator("text=Manually add completions").click()
  // Click textarea[name="completions"]
  await page.locator('textarea[name="completions"]').click()
  // Fill textarea[name="completions"]
  await page.locator('textarea[name="completions"]').fill(`user_id,grade
  00e249d8-345f-4eff-aedb-7bdc4c44c1d5,5
  8d7d6c8c-4c31-48ae-8e20-c68fa95c25cc,4
  fbeb9286-3dd8-4896-a6b8-3faffa3fabd6,4
  3524d694-7fa8-4e73-aa1a-de9a20fd514b,3`)

  // Click text=Check
  await page.locator("text=Check").click()

  // Click div[role="button"]:has-text("Users receiving a completion for the first time (3)")
  await page
    .locator('div[role="button"]:has-text("Users receiving a completion for the first time (3)")')
    .click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "manual-completion-default-module-preview",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Users receiving a completion for the first time"),
      page.locator("text=Submit"),
    ],
    screenshotTarget: page,
  })

  // Click button:has-text("Submit")
  await page.locator('button:has-text("Submit")').click()

  await page.getByText(`Completions submitted successfully`).waitFor()

  // Click text=Manually add completions
  await page.locator("text=Manually add completions").click()

  // Select 57db3a62-d098-489a-8869-0a14efd6fa80
  await page.locator("select").selectOption({ label: "Another module" })

  // Click textarea[name="completions"]
  await page.locator('textarea[name="completions"]').click()
  // Fill textarea[name="completions"]
  await page.locator('textarea[name="completions"]').fill(`user_id
  00e249d8-345f-4eff-aedb-7bdc4c44c1d5
  fbeb9286-3dd8-4896-a6b8-3faffa3fabd6`)

  // Click text=Check
  await page.locator("text=Check").click()
  // Click div[role="button"]:has-text("Users receiving a completion for the first time (2)")
  await page
    .locator('div[role="button"]:has-text("Users receiving a completion for the first time (2)")')
    .click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "manual-completion-another-module-preview",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Users receiving a completion for the first time"),
      page.locator("text=Submit"),
    ],
    screenshotTarget: page,
  })

  // Click button:has-text("Submit")
  await page.locator('button:has-text("Submit")').click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "manual-completion-after-posting-completions",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=User1"),
      page.locator("text=User2"),
      page.locator("text=User3"),
      page.locator("text=User4"),
      page.locator("text=Completions submitted successfully."),
    ],
    screenshotTarget: page,
    beforeScreenshot: () => page.locator("text=User1").scrollIntoViewIfNeeded(),
  })

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export completions as CSV)" }).click(),
  ])

  const completionsCsvContents = await downloadToString(download)
  expect(completionsCsvContents).toContain("user_id,first_name,last_name,email")
  expect(completionsCsvContents).toContain("user_2@example.com,4,false,-,,-,")
  expect(completionsCsvContents).toContain("user_3@example.com,4,false,pass,false,-,")
})
