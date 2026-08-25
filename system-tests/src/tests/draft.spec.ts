/* oxlint-disable playwright/prefer-locator */
import { expect, test } from "@playwright/test"

import { createCourse } from "@/utils/flows/newCourse.flow"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.describe("anonymous user", () => {
  test("cannot see draft course", async ({ page }) => {
    await page.goto("http://project-331.local/organizations")

    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )

    await expect(page.getByText("Introduction to Statistics")).toBeVisible()
    await expect(page.getByText("Introduction to Drafts")).toBeHidden()
  })
})

test.describe("user", () => {
  test.use({
    storageState: "src/states/user@example.com.json",
  })

  test("cannot see draft course", async ({ page }) => {
    await page.goto("http://project-331.local/organizations")

    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )

    await expect(page.getByText("Introduction to Statistics")).toBeVisible()
    await expect(page.getByText("Introduction to Drafts")).toBeHidden()
  })

  test("cannot directly navigate to the draft course page", async ({ page }) => {
    await page.goto("http://project-331.local/org/uh-mathstat/courses/introduction-to-drafts")
    await page.getByRole("heading", { name: /Forbidden|Unauthorized/i }).waitFor()
    await page
      .getByText(/do not have permission|Unauthorized/i)
      .first()
      .waitFor()
    await expect(page.getByText("Introduction to Drafts")).toBeHidden()
  })
})

test.describe("admin", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test("can see draft course", async ({ page }) => {
    await page.goto("http://project-331.local/organizations")

    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )

    await expect(page.getByText("Introduction to Statistics")).toBeVisible()
    await expect(page.getByText("Introduction to Drafts")).toBeVisible()
  })

  test("can create a draft course and change it to a non-draft course", async ({
    page,
    headless,
  }, testInfo) => {
    await page.goto("http://project-331.local/organizations")

    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )
    await expect(page.getByText("Introduction to Statistics")).toBeVisible()

    await createCourse(page, {
      name: "Advanced drafts",
      language: "English",
      teacherInChargeName: "admin",
      teacherInChargeEmail: "admin@example.com",
    })

    await page.locator("[aria-label=\"Manage\\ course\\ \\'Advanced\\ drafts\\'\"] svg").click()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "draft-course",
      waitForTheseToBeVisibleAndStable: [page.getByText("Advanced drafts (Draft)")],
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
      clearNotifications: true,
    })
  })
})

test.describe("Teacher", () => {
  test.use({
    storageState: "src/states/teacher@example.com.json",
  })

  test("Can give students access to the draft course", async ({ page, browser }) => {
    await page.goto("http://project-331.local/organizations")
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")
    await createCourse(page, {
      name: "Best draft course",
      language: "English",
      teacherInChargeName: "Draft Teacher",
      teacherInChargeEmail: "draft@example.com",
      description: "draft",
    })
    await page.getByText("Course created successfully").waitFor()
    await page.getByRole("link", { name: "Manage course 'Best draft course'" }).click()
    await page.getByRole("tab", { name: "Permissions" }).click()
    await page.getByPlaceholder("Enter email").click()
    await page.getByPlaceholder("Enter email").fill("user@example.com")
    await page.getByRole("combobox", { name: "Role" }).selectOption("MaterialViewer")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Add user" }).click()
    })

    // check that the user can access the course
    const context2 = await browser.newContext({ storageState: "src/states/user@example.com.json" })
    const page2 = await context2.newPage()
    await page2.goto("http://project-331.local/org/uh-mathstat/courses/best-draft-course")
    await selectCourseInstanceIfPrompted(page2)
    await page2.getByRole("heading", { name: "In this course you'll..." }).click()
    await context2.close()
  })

  test("teacher gets permissions to new course when copying a course", async ({ page }) => {
    await page.goto("http://project-331.local/organizations")
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")
    await createCourse(page, {
      name: "Introduction to localizing copy",
      language: "English",
      teacherInChargeName: "Draft Teacher",
      teacherInChargeEmail: "draft@example.com",
      copyContentFromCourseId: "639f4d25-9376-49b5-bcca-7cba18c38565",
    })
    await page.getByText("Course created successfully").waitFor()

    await page
      .getByRole("link", { name: "Manage course 'Introduction to localizing copy'" })
      .click()
    await page.getByRole("tab", { name: "Permissions" }).click()
    await expect(page.getByText("teacher@example.com", { exact: true })).toBeVisible()
  })

  test("teacher can copy course and grant users the same permissions as the original course", async ({
    page,
  }) => {
    await page.goto("http://project-331.local/organizations")
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")
    await createCourse(page, {
      name: "Introduction to localizing copy with permissions",
      language: "English",
      teacherInChargeName: "Draft Teacher",
      teacherInChargeEmail: "draft@example.com",
      copyContentFromCourseId: "639f4d25-9376-49b5-bcca-7cba18c38565",
      grantAccessToOriginalUsers: true,
    })
    await page.getByText("Course created successfully").waitFor()

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
