import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { manageOrganization } from "@/utils/organizationUtils"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Organization workflow", async ({ page }) => {
  await test.step("Create new organization", async () => {
    await page.goto("http://project-331.local/")
    await page.getByRole("link", { name: "All organizations" }).click()
    await page.getByRole("button", { name: "Create a new organization" }).click()
    await page.getByRole("textbox", { name: "Organization name" }).click()
    await page.getByRole("textbox", { name: "Organization name" }).fill("New Test")
    await page.getByRole("textbox", { name: "Slug" }).click()
    await page.getByRole("textbox", { name: "Slug" }).fill("newslug")

    await waitForSuccessNotification(page, async () => {
      await page.getByTestId("dialog").getByRole("button", { name: "Create" }).click()
    })
  })

  await test.step("Can see the new organization in manage page", async () => {
    await manageOrganization(page, "New Test")
    await page.getByLabel("General").getByText("New Test").waitFor()
    await page.getByText("newslug", { exact: true }).waitFor()
  })

  await test.step("Edit the organization", async () => {
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByRole("textbox", { name: "Name" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("New Test Edited")
    await page.getByRole("textbox", { name: "Slug" }).click()
    await page.getByRole("textbox", { name: "Slug" }).fill("newslugedited")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save" }).click()
    })
    await page.getByLabel("General").getByText("New Test Edited").waitFor()
    await page.getByLabel("General").getByText("newslugedited").waitFor()
  })

  await test.step("Add user permissions", async () => {
    await page.getByRole("tab", { name: "Permissions" }).click()
    await page.getByRole("button", { name: "Add user" }).click()
    await page.getByRole("textbox", { name: "Email" }).click()
    await page.getByRole("textbox", { name: "Email" }).fill("teacher@example.com")
    await page.getByLabel("Role").selectOption("Teacher")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save" }).click()
    })
    await page.getByText("Teacher", { exact: true }).click()
  })

  await test.step("Edit user permissions", async () => {
    await page.getByRole("button", { name: "Edit user Teacher Example" }).click()
    await page.getByTestId("dialog").getByLabel("Role").selectOption("Reviewer")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save" }).click()
    })
    await page.getByText("Reviewer").click()
    page.once("dialog", (dialog) => {
      console.log(`Dialog message: ${dialog.message()}`)
      dialog.dismiss().catch(() => {})
    })
  })

  await test.step("Delete user permissions and organization", async () => {
    await page.getByRole("button", { name: "Delete user Teacher Example" }).click()
    await page.getByRole("tab", { name: "General" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByRole("button", { name: "Delete organization" }).click()
    await page.getByTestId("dialog").getByRole("textbox").click()
    await page.getByTestId("dialog").getByRole("textbox").fill("delete")
    await waitForSuccessNotification(
      page,
      async () => {
        await page.getByRole("button", { name: "Confirm" }).click()
      },
      "Successfully deleted",
    )
    await expect(page.getByRole("heading", { name: "New Test Edited" })).toHaveCount(0)
  })
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
