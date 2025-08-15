import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

import { manageOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("create new organization, edit it and it's permissions, and delete it", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()

  // Create organization
  await page.getByRole("button", { name: "Create a new organization" }).click()
  await page.getByRole("textbox", { name: "Organization name" }).click()
  await page.getByRole("textbox", { name: "Organization name" }).fill("createnewtestorganization")
  await page.getByRole("textbox", { name: "Slug" }).click()
  await page.getByRole("textbox", { name: "Slug" }).fill("createnewtestorganizationslug")
  await page.getByTestId("dialog").getByRole("button", { name: "Create" }).click()
  await page.getByRole("heading", { name: "createnewtestorganization" }).click()
  await manageOrganization(page, "createnewtestorganization")
  await page.getByText("createnewtestorganization", { exact: true }).click()
  await page.getByText("createnewtestorganizationslug").click()

  // Edit organization
  await page.getByRole("button", { name: "Edit" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("createnewtestorganizationedited")
  await page.getByRole("textbox", { name: "Slug" }).fill("createnewtestorganizationslugedited")
  await page.getByRole("button", { name: "Save" }).click()
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()
  await page.getByRole("heading", { name: "createnewtestorganizationedited" }).click()
  await manageOrganization(page, "createnewtestorganizationedited")
  await page.getByText("createnewtestorganizationedited", { exact: true }).click()
  await page.getByText("createnewtestorganizationslugedited").click()

  // Add user with a role
  await page.getByRole("tab", { name: "Permissions" }).click()
  await page.getByRole("button", { name: "Add user" }).click()
  await page.getByRole("textbox", { name: "Email" }).click()
  await page.getByRole("textbox", { name: "Email" }).fill("teacher@example.com")
  await page.getByLabel("Role").selectOption("Teacher")
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Teacher", { exact: true }).click()
  await page.getByText("teacher@example.com").click()
  await page.getByText("Teacher Example").click()

  // Edit teacher role
  await page.getByRole("button", { name: "Edit user Teacher Example" }).click()
  await page.getByTestId("dialog").getByLabel("Role").selectOption("CourseOrExamCreator")
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("CourseOrExamCreator").click()
  await page.getByText("teacher@example.com").click()
  await page.getByText("Teacher Example").click()

  // Delete teacher
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("teacher@example.com") // Optional
    dialog.accept()
  })

  await page.getByRole("button", { name: "Delete user Teacher Example" }).click()
  await expect(page.getByText("teacher@example.com")).toHaveCount(0)

  // Delete organization
  await page.getByRole("tab", { name: "General" }).click()
  await page.getByRole("button", { name: "Edit" }).click()
  await page.getByRole("button", { name: "Delete organization" }).click()
  await page.getByTestId("dialog").getByRole("textbox").click()
  await page.getByTestId("dialog").getByRole("textbox").fill("delete")
  await page.getByRole("button", { name: "Confirm" }).click()
  await page.getByText("Success", { exact: true }).click()
  await expect(page.getByText("teacher@createnewtestorganizationedited.com")).toHaveCount(0)
})

test("Organization list renders", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/manage/exercise-services")
  await page.goto("http://project-331.local/organizations")
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "frontpage-organizations-list",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("University of Helsinki, Department of Computer Science"),
    ],
  })
})
