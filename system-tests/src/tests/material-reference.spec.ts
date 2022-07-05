import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("material reference tests", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  // Click [aria-label="Manage course \'Introduction to everything\'"] svg
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5' }*/),
    page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] svg").click(),
  ])

  // Click a[role="tab"]:has-text("References")
  await page.locator('a[role="tab"]:has-text("References")').click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/references",
  )

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "material-reference-list",
    waitForThisToBeVisibleAndStable: ["text=Add new reference"],
  })

  // Click text=Add new reference
  await page.locator("text=Add new reference").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["page-has-heading-one"],
    page,
    headless,
    snapshotName: "add-new-material-reference-dialog",
    waitForThisToBeVisibleAndStable: ["text=Submit", "text=Close"],
  })

  // Click textarea[name="references"]
  await page.locator('textarea[name="references"]').click()

  // Fill textarea[name="references"]
  await page
    .locator('textarea[name="references"]')
    .fill(
      "@incollection{wang2003artificial,\n  title={Artificial neural network},\n  author={Wang, Sun-Chong},\n  booktitle={Interdisciplinary computing in java programming},\n  pages={81--100},\n  year={2003},\n  publisher={Springer}\n}\n",
    )

  // Click text=Submit
  await page.locator("text=Submit").click()

  await page.locator("text=Success").waitFor()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["heading-order"],
    page,
    headless,
    snapshotName: "new-material-reference-added",
    waitForThisToBeVisibleAndStable: ["text=Add new reference"],
    clearNotifications: true,
  })

  await page.locator("text=Edit reference").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["heading-order", "page-has-heading-one"],
    page,
    headless,
    snapshotName: "material-reference-editor",
    waitForThisToBeVisibleAndStable: ["text=Edit reference"],
  })

  // Fill textarea[name="references"]
  await page
    .locator('textarea[name="reference"]')
    .fill(
      "@incollection{wang2003,\n  title={Artificial neural network},\n  author={Wang, Sun-Chong},\n  booktitle={Interdisciplinary computing in java programming},\n  pages={81--100},\n  year={2003},\n  publisher={Springer}\n}\n",
    )

  await page.locator("text=Save").click()

  await page.locator("text=Success").waitFor()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["heading-order"],
    page,
    headless,
    snapshotName: "material-reference-edited",
    waitForThisToBeVisibleAndStable: ["text=Add new reference"],
    clearNotifications: true,
  })

  // Click text=Pages
  await page.locator("text=Pages").click()

  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/pages",
  )

  // Click text=Page One/chapter-1/page-1Edit page >> button >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/30fe1090-f2d6-4e7c-9812-44cd3c0b9304' }*/),
    page.locator("text=Page One/chapter-1/page-1Edit page >> button").first().click(),
  ])

  // Click [aria-label="Add block"]
  await page.locator('[aria-label="Add block"]').click()

  // Click button[role="option"]:has-text("Paragraph")
  await page.locator('button[role="option"]:has-text("Paragraph")').click()

  const PARAGRAPH = `This paragraph contains a citation\\cite{wang2003}.`

  // Click [aria-label="Empty block\; start writing or type forward slash to choose a block"]
  await page.fill(
    '[aria-label="Empty block\\; start writing or type forward slash to choose a block"]',
    PARAGRAPH,
  )

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["region", "aria-allowed-attr"],
    page,
    headless,
    snapshotName: "citation-in-editor",
    beforeScreenshot: async () => await page.locator(`text=${PARAGRAPH}`).scrollIntoViewIfNeeded(),
  })

  // Click text=Save >> nth=3
  await page.locator("text=Save").nth(3).click()

  await page.goto(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
  )

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "citation-paragraph",
    beforeScreenshot: async () =>
      await page.locator(`text=This paragraph contains a citation`).scrollIntoViewIfNeeded(),
  })

  await page.locator("text=Reference").scrollIntoViewIfNeeded()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "closed-course-material-reference-list",
    waitForThisToBeVisibleAndStable: ["text=Reference"],
    beforeScreenshot: async () => await page.locator("text=Reference").scrollIntoViewIfNeeded(),
  })

  // Click text=Reference
  await page.locator("text=Reference").click()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "open-course-material-reference-list",
    waitForThisToBeVisibleAndStable: ["text=Reference", "text=Wang"],
    beforeScreenshot: async () => await page.locator("text=Reference").scrollIntoViewIfNeeded(),
  })
})
