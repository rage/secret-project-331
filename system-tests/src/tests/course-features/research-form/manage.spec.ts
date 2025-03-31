import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Can create a new research form for a course", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page
    .getByRole("link", { name: "Manage course 'Advanced course instance management'" })
    .click()
  await page.getByRole("button", { name: "Create or edit research form" }).click()
  await page.getByRole("button", { name: "create" }).click()
  await page.getByRole("button", { name: "Add block" }).click()
  await page.getByRole("option", { name: "Heading" }).click()
  await page.getByRole("document", { name: "Block: Heading" }).fill("Research form")
  await page.getByRole("combobox", { name: "Toggle view" }).selectOption("block-menu")
  await page.getByRole("option", { name: "Paragraph" }).click()
  await page
    .getByRole("document", {
      name: "Empty block; start writing or type forward slash to choose a block",
    })
    .fill("This course does research")
  await page.getByRole("option", { name: "Research Form Question" }).click()
  await page
    .getByRole("document", { name: "Block: Research Form Question" })
    .locator("div")
    .nth(1)
    .click()
  await page.getByRole("textbox").fill("I want to take part in reseach")
  await page.getByRole("textbox").press("ArrowLeft")
  await page.getByRole("textbox").fill("I want to take part in research")
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Operation successful!").waitFor()
})

test("Research form is shown on a coursepage if not answered", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto("http://project-331.local/org/uh-cs/courses/advanced-course-instance-management")
  await selectCourseInstanceIfPrompted(page, "Non-default instance")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "research-consent-form-shows-if-not-aswered",
    waitForTheseToBeVisibleAndStable: [page.getByText("Research form")],
  })
  await page.getByText("I want to take part in research").click()
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Operation successful!").waitFor()
})

test("User can change answer of the research form", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/org/uh-cs/courses/advanced-course-instance-management")
  await selectCourseInstanceIfPrompted(page, "Non-default instance")
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "User settings" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "research-consent-form-shows-in-user-setting-page",
    waitForTheseToBeVisibleAndStable: [page.getByText("Advanced course instance management")],
  })
  await page.getByRole("link", { name: "Edit" }).getByRole("button", { name: "Edit" }).click()

  await expect(page.getByLabel("I want to take part in research")).toBeChecked()

  await page.getByText("I want to take part in research").click()
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("User settings").waitFor()
})
