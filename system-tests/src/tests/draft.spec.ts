import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.describe("anonymous user", () => {
  test("cannot see draft course", async ({ page }) => {
    // Go to http://project-331.local/
    await page.goto("http://project-331.local/")

    // Click text=University of Helsinki, Department of Mathematics and Statistics
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-mathstat' }*/),
      page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
    ])

    await expect(page.locator("text=Introduction to Statistics")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).not.toBeVisible()
  })
})

test.describe("user", () => {
  test.use({
    storageState: "src/states/user@example.com.json",
  })
  test("cannot see draft course", async ({ page }) => {
    // Go to http://project-331.local/
    await page.goto("http://project-331.local/")

    // Click text=University of Helsinki, Department of Mathematics and Statistics
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-mathstat' }*/),
      page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
    ])

    await expect(page.locator("text=Introduction to Statistics")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).not.toBeVisible()
  })
  test("cannot directly navigate to the draft course page", async ({ page }) => {
    await page.goto("http://project-331.local/org/uh-mathstat/courses/introduction-to-drafts")
    await expect(page.locator("text=Forbidden")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).not.toBeVisible()
  })
})

test.describe("admin", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("can see draft course", async ({ page }) => {
    // Go to http://project-331.local/
    await page.goto("http://project-331.local/")

    // Click text=University of Helsinki, Department of Mathematics and Statistics
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-mathstat' }*/),
      page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
    ])

    await expect(page.locator("text=Introduction to Statistics")).toBeVisible()
    await expect(page.locator("text=Introduction to Drafts")).toBeVisible()
  })
  test("can create a draft course and change it to a non-draft course", async ({
    page,
    headless,
  }) => {
    // Go to http://project-331.local/
    await page.goto("http://project-331.local/")
    // Click text=University of Helsinki, Department of Mathematics and Statistics
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-mathstat' }*/),
      page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
    ])
    // Click text=Create
    await page.click(`button:text("Create")`)
    // Fill input
    await page.fill("input[label=Name]", "Advanced drafts")
    // Fill .css-1cftqx7 div div:nth-child(3) div label .css-1m9fudm
    await page.fill('input[label="Teacher in charge name"]', "admin")
    // Fill div div:nth-child(4) div label .css-1m9fudm
    await page.fill('input[label="Teacher in charge email"]', "admin@example.com")
    // Check input[type="checkbox"]
    await page.check("input[label=Draft]")
    // Click input[name="language-code"]
    await page.check("input[label=English]")
    // Click div[role="dialog"] >> text=Create
    await page.click('div[role="dialog"] >> text=Create')
    // Click [aria-label="Manage\ course\ \'Advanced\ drafts\'"] svg
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/265c83b6-7faf-40bf-90e9-40a4c28f826c' }*/),
      page.click("[aria-label=\"Manage\\ course\\ \\'Advanced\\ drafts\\'\"] svg"),
    ])

    await expectScreenshotsToMatchSnapshots({
      page,
      headless,
      snapshotName: "draft-course",
      waitForThisToBeVisibleAndStable: "text=Advanced drafts (Draft)",
    })

    // Click text=Edit
    await page.click("text=Edit")
    // Uncheck input[type="checkbox"]
    await page.uncheck('input[type="checkbox"]')
    // Click text=Update
    await page.click("text=Update")
    await page.locator("text=Update").waitFor({ state: "hidden" })

    await expectScreenshotsToMatchSnapshots({
      page,
      headless,
      snapshotName: "non-draft-course",
      waitForThisToBeVisibleAndStable: "text=Advanced drafts",
    })
  })
})
