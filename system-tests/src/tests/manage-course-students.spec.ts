import { expect, test } from "@playwright/test"

const COURSE_ID = "51ce5ea4-2587-407e-bea9-421309f77f69"
const STUDENTS_URL = `http://project-331.local/manage/courses/${COURSE_ID}/students`

test.use({
  storageState: "src/states/admin@example.com.json",
})

test.describe("Manage course students tab", () => {
  test("lists students, filters by search, and switches subtabs", async ({ page }) => {
    await page.goto(STUDENTS_URL)

    // The index route redirects to the Users subtab, which lists enrolled students.
    await expect(page).toHaveURL(/\/students\/users/)
    await expect(page.getByText("user_1@example.com")).toBeVisible()

    // A functional course-instance filter lives next to the search box.
    await expect(page.getByRole("combobox", { name: "Course instance" })).toBeVisible()

    // The shared search box filters rows server-side across every subtab.
    const search = page.getByPlaceholder("Search students...")
    await search.fill("user_3@example.com")
    await expect(page.getByText("user_3@example.com")).toBeVisible()
    await expect(page.getByText("user_1@example.com")).toBeHidden()
    await search.fill("")
    await expect(page.getByText("user_1@example.com")).toBeVisible()

    // Completions subtab renders its (sticky) table header.
    await page.getByRole("tab", { name: "Completions" }).click()
    await expect(page).toHaveURL(/\/students\/completions/)
    await expect(page.getByRole("columnheader", { name: "Student" })).toBeVisible()

    // Progress subtab renders its grouped header.
    await page.getByRole("tab", { name: "Progress" }).click()
    await expect(page).toHaveURL(/\/students\/progress/)
    await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible()

    // Certificates subtab renders its table header.
    await page.getByRole("tab", { name: "Certificates" }).click()
    await expect(page).toHaveURL(/\/students\/certificates/)
    await expect(page.getByRole("columnheader", { name: "Certificate", exact: true })).toBeVisible()
  })
})
