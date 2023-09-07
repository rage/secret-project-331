import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
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

    await page.check(`label:has-text("English")`)

    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click()

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

    await page.getByRole("dialog").getByRole("button", { name: "Update" }).click()
    await page.getByRole("button", { name: "Update", exact: true }).waitFor({ state: "hidden" })

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "non-draft-course",
      waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Advanced drafts" })],
    })
  })
})

test.describe("Teacher", () => {
  test.use({
    storageState: "src/states/teacher@example.com.json",
  })

  test("Can give students access to the draft course", async ({ page, browser }) => {
    await page.goto("http://project-331.local/")
    await page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page.getByRole("button", { name: "Create" }).first().click()
    await page.getByLabel("Name  *", { exact: true }).fill("Best draft course")
    await page.getByLabel("Teacher in charge name  *").fill("Draft Teacher")
    await page.getByLabel("Teacher in charge email  *").fill("draft@example.com")
    await page.getByLabel("Description").fill("draft")
    await page.locator("label").filter({ hasText: "English" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click()
    await page.getByText("Operation successful!").waitFor()
    await page.getByRole("link", { name: "Manage course 'Best draft course'" }).click()
    await page.getByRole("tab", { name: "Permissions" }).click()
    await page.getByPlaceholder("Enter email").click()
    await page.getByPlaceholder("Enter email").fill("user@example.com")
    await page.getByRole("combobox", { name: "Role" }).selectOption("MaterialViewer")
    await page.getByRole("button", { name: "Add user" }).click()
    await page.getByText("Operation successful!").waitFor()

    // check that the user can access the course
    const context2 = await browser.newContext({ storageState: "src/states/user@example.com.json" })
    const page2 = await context2.newPage()
    await page2.goto("http://project-331.local/org/uh-mathstat/courses/best-draft-course")
    await selectCourseInstanceIfPrompted(page2)
    await page2.getByRole("heading", { name: "In this course you'll..." }).click()
    await context2.close()
  })

  test("teacher gets permissions to new course when copying a course", async ({ page }) => {
    await page.goto("http://project-331.local/")
    await page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page.getByRole("button", { name: "Create" }).first().click()
    await page.getByLabel("Teacher in charge name  *").fill("Draft Teacher")
    await page.getByLabel("Teacher in charge email  *").fill("draft@example.com")
    await page.getByLabel("Copy content from another course").check()
    await page
      .locator("#duplicate-course-select-menu")
      .selectOption("639f4d25-9376-49b5-bcca-7cba18c38565")
    await page.getByLabel("Name  *", { exact: true }).click()
    await page.getByLabel("Name  *", { exact: true }).fill("Introduction to localizing copy")
    await page.getByLabel("English").check()
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click()
    await page.getByText("Operation successful!").waitFor()

    await page
      .getByRole("link", { name: "Manage course 'Introduction to localizing copy'" })
      .click()
    await page.getByRole("tab", { name: "Permissions" }).click()
    await expect(page.getByText("teacher@example.com", { exact: true })).toBeVisible()
  })

  test("teacher can copy course and grant users the same permissions as the original course", async ({
    page,
  }) => {
    await page.goto("http://project-331.local/")
    await page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page.getByRole("button", { name: "Create" }).first().click()
    await page.getByLabel("Teacher in charge name  *").fill("Draft Teacher")
    await page.getByLabel("Teacher in charge email  *").fill("draft@example.com")
    await page.getByLabel("Copy content from another course").check()
    await page
      .locator("#duplicate-course-select-menu")
      .selectOption("639f4d25-9376-49b5-bcca-7cba18c38565")
    await page
      .getByLabel("Grant access to this course to everyone who had access to the original one")
      .check()
    await page.getByLabel("Name  *", { exact: true }).click()
    await page
      .getByLabel("Name  *", { exact: true })
      .fill("Introduction to localizing copy with permissions")
    await page.getByLabel("English").check()
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click()
    await page.getByText("Operation successful!").waitFor()

    await page
      .getByRole("link", {
        name: "Manage course 'Introduction to localizing copy with permissions",
      })
      .click()
    await page.getByRole("tab", { name: "Permissions" }).click()
    await expect(page.getByText("teacher@example.com", { exact: true })).toBeVisible()
    await expect(page.getByText("language.teacher@example.com", { exact: true })).toBeVisible()
  })
})
