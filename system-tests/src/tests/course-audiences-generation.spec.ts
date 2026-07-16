import { test, expect } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Teacher can generate and add suggested audiences", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByRole("listitem").filter({ hasText: "students" })).toBeVisible()
})

test("Teacher can add new audience", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("button", { name: "Add new audience" }).click()
  await page.getByRole("textbox", { name: "Audience 2" }).fill("this should be visible")
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByRole("button", { name: "Replace metadata" })).toBeEnabled()
  await expect(page.getByText("this should be visible")).toBeVisible()
})

test("Teacher can remove suggested audience", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("textbox", { name: "Audience 1" }).fill("this should be not be visible")
  await page.getByRole("button", { name: "Remove" }).nth(2).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(
    page.getByRole("listitem").filter({ hasText: "this should be not be visible" }),
  ).toHaveCount(0)
})

test("No duplicate audiences added", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByRole("listitem").filter({ hasText: "students" })).toHaveCount(1)
})

test("Audiences not added if use suggested unticked", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("textbox", { name: "Audience" }).click()
  await page.getByRole("textbox", { name: "Audience" }).fill("not here")
  await page.getByRole("button", { name: "Add new audience" }).click()
  await page.getByRole("textbox", { name: "Audience 2" }).click()
  await page.getByRole("textbox", { name: "Audience 2" }).fill("not visible")
  await page.getByTestId("container-suggested-audiences").getByRole("checkbox").click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByText("not here")).toHaveCount(0)
  await expect(page.getByText("not visible")).toHaveCount(0)
})

test("Old audiences are replaced", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 1" }).click()
  await page.getByRole("textbox", { name: "Audience 1" }).press("ControlOrMeta+a")
  await page.getByRole("textbox", { name: "Audience 1" }).fill("this replaces")
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByRole("listitem").filter({ hasText: "students" })).toHaveCount(0)
  await expect(page.getByText("this replaces")).toBeVisible()
})
