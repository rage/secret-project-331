import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.describe("anonymous user", () => {
  test("cannot see draft course", async ({ page }) => {
    await page.goto("http://project-331.local/")

    await Promise.all([
      page.locator("text=University of Helsinki, Department of Mathematics and Statistics").click(),
    ])

    await expect(page.locator("text=Introduction to Statistics")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).toBeHidden()
  })
})

test.describe("user", () => {
  test.use({
    storageState: "src/states/user@example.com.json",
  })
  test("cannot see draft course", async ({ page }) => {
    await page.goto("http://project-331.local/")

    await Promise.all([
      page.locator("text=University of Helsinki, Department of Mathematics and Statistics").click(),
    ])

    await expect(page.locator("text=Introduction to Statistics")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).toBeHidden()
  })
  test("cannot directly navigate to the draft course page", async ({ page }) => {
    await page.goto("http://project-331.local/org/uh-mathstat/courses/introduction-to-drafts")
    await expect(page.locator("text=Forbidden")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).toBeHidden()
  })
})

test.describe("admin", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("can see draft course", async ({ page }) => {
    await page.goto("http://project-331.local/")

    await Promise.all([
      page.locator("text=University of Helsinki, Department of Mathematics and Statistics").click(),
    ])

    await expect(page.locator("text=Introduction to Statistics")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).toBeVisible()
  })
  test("can create a draft course and change it to a non-draft course", async ({
    page,
    headless,
  }, testInfo) => {
    await page.goto("http://project-331.local/")

    await Promise.all([
      page.locator("text=University of Helsinki, Department of Mathematics and Statistics").click(),
    ])

    await page.click(`button:text("Create")`)
    // Fill input
    await page.fill("input[label=Name]", "Advanced drafts")
    // Fill .css-1cftqx7 div div:nth-child(3) div label .css-1m9fudm
    await page.fill('input[label="Teacher in charge name"]', "admin")
    // Fill div div:nth-child(4) div label .css-1m9fudm
    await page.fill('input[label="Teacher in charge email"]', "admin@example.com")
    // Check input[type="checkbox"]
    await page.check("input[label=Draft]")

    await page.check(`label:has-text("English")`)

    await page.click('div[role="dialog"] >> text=Create')

    await page.locator("[aria-label=\"Manage\\ course\\ \\'Advanced\\ drafts\\'\"] svg").click()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "draft-course",
      waitForTheseToBeVisibleAndStable: [page.locator("text=Advanced drafts (Draft)")],
    })

    await page.getByRole("button", { name: "Edit" }).first().click()
    // Uncheck input[type="checkbox"]
    await page.uncheck('input[type="checkbox"]')

    await page.click(`button:text-is("Update")`)
    await page.locator(`button:text-is("Update")`).waitFor({ state: "hidden" })

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "non-draft-course",
      waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Advanced drafts" })],
    })
  })
})
