import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test("User can add missing country information", async ({ page }) => {
  await test.step("Pop-up form for existing user who is missing country info", async () => {
    await page.goto(
      "http://project-331.local/login?return_to=%2Forg%2Fuh-cs%2Fcourses%2Fadvanced-course-instance-management",
    )
    await page
      .getByRole("textbox", { name: "Email (Required)" })
      .fill("student-without-country@example.com")
    await page.getByRole("textbox", { name: "Password (Required)" }).fill("student-without-country")
    await page.getByRole("button", { name: "Log in" }).click()

    // Form to fill missing country
    // the course instance selection is sometimes prompted before the country
    // so we will await both simultaneously
    const countryPrompt = async () => {
      await expect(page.getByRole("heading", { name: "Fill missing information" })).toBeVisible()
      await page.getByRole("button", { name: "Select a country Where do you" }).click()
      await page.getByLabel("Suggestions").getByText("Andorra").click()
      await page.getByRole("button", { name: "Save" }).click()
      await expect(page.getByText("Success", { exact: true })).toBeVisible()
    }
    await Promise.all([selectCourseInstanceIfPrompted(page), countryPrompt()])

    // Go to user setting and change users country
    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "User settings" }).click()
    await expect(page.getByRole("button", { name: "Andorra Where do you live? *" })).toBeVisible()
    await page.getByRole("button", { name: "Andorra Where do you live? *" }).click()
    await page.getByRole("searchbox", { name: "Search..." }).fill("fin")
    await page.getByLabel("Suggestions").getByText("Finland").click()
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Success", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Finland Where do you live? *" })).toBeVisible()

    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "Log out" }).click()
  })

  await test.step("Add country when creating a new user and see that pop-up form doesn't show", async () => {
    await page.goto(
      "http://project-331.local/signup?return_to=%2Forg%2Fuh-cs%2Fcourses%2Fadvanced-course-instance-management&lang=en-US",
    )
    await page.getByRole("textbox", { name: "First name (Required)" }).fill("Test")
    await page.getByRole("textbox", { name: "Last name (Required)" }).fill("User")
    await page.getByRole("button", { name: "Select an item Where do you" }).click()
    await page.getByLabel("Suggestions").getByText("Andorra").click()
    await page.getByRole("textbox", { name: "Email (Required)" }).fill("test-user@example.com")
    await page.getByRole("textbox", { name: "Password (Required)", exact: true }).fill("test-user")
    await page.getByRole("textbox", { name: "Confirm password (Required)" }).fill("test-user")
    await page.getByText("I consent to receiving email communication").click()

    await page.getByRole("button", { name: "Create an account" }).click()

    await expect(page.getByText("Success", { exact: true })).toBeVisible()

    await page.getByText("I want to participate in the").click()
    await page.getByRole("button", { name: "Save" }).click()
    await page.getByRole("button", { name: "Done" }).click()
    await page.getByText("Default", { exact: true }).click()
    await selectCourseInstanceIfPrompted(page)
  })
})
