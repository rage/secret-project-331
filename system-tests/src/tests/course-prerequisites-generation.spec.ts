import { test, expect } from "@playwright/test"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Teacher can generate and add suggested prerequisites", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(
    page.getByRole("listitem").filter({ hasText: "No hard prerequisites" }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Linux operating systems and web development experience are useful" }),
  ).toBeVisible()
})

test("Teacher can add new prerequisite", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("button", { name: "Add new prerequisite" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 3" }).fill("this should be visible")
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await expect(page.getByText("this should be visible")).toBeVisible()
})

test("Teacher can remove suggested prerequisite", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 2" }).fill("this should be not be visible")
  await page.getByRole("button", { name: "Remove" }).nth(1).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await expect(page.getByText("this should be not be visible")).toHaveCount(0)
})

test("No duplicate prerequisites added", async ({ page }) => {
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
  await expect(page.getByText("No hard prerequisites")).toHaveCount(1)
})

test("Prerequisites not added if use suggested unticked", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 1" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 1" }).fill("should not be added")
  await page.getByRole("textbox", { name: "Prerequisite 2" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 2" }).press("ControlOrMeta+a")
  await page.getByRole("textbox", { name: "Prerequisite 2" }).fill("you dont see me")
  await page.getByTestId("container-suggested-prerequisites").getByRole("checkbox").click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await expect(page.getByText("should not be added")).toHaveCount(0)
  await expect(page.getByText("you dont see me")).toHaveCount(0)
})

test("Old prerequisites are replaced", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 1" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 1" }).press("ControlOrMeta+a")
  await page.getByRole("textbox", { name: "Prerequisite 1" }).fill("this replaces")
  await page.getByRole("textbox", { name: "Prerequisite 2" }).click()
  await page.getByRole("textbox", { name: "Prerequisite 2" }).press("ControlOrMeta+a")
  await page.getByRole("textbox", { name: "Prerequisite 2" }).fill("test")
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await expect(page.getByText("No hard prerequisites")).toHaveCount(0)
  await expect(
    page.getByText("Linux operating systems and web development experience are useful"),
  ).toHaveCount(0)
  await expect(page.getByText("this replaces")).toBeVisible()
  await expect(page.getByText("test")).toBeVisible()
})
