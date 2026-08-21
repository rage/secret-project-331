import { expect, test } from "@playwright/test"

import { waitForErrorNotification, waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const ADDITIONAL_MESSAGE = "THIS COURSE HAS CLOSED UNTIL FURTHER NOTICE"

test.describe("Course auditing", () => {
  test("Editing course data successfully", async ({ page }) => {
    await page.goto("http://project-331.local/")
    await page.getByRole("link", { name: "Course auditing" }).click()
    await page.getByRole("switch", { name: "Not closed" }).click()

    const auditingCourseCard = page
      .getByTestId("course-auditing-card")
      .filter({ hasText: "Introduction to course auditing" })

    const descriptionBox = auditingCourseCard
      .getByTestId("content-display-box")
      .filter({ hasText: "Description" })
    const prerequisitesBox = auditingCourseCard
      .getByTestId("content-display-box")
      .filter({ hasText: "Prerequisites" })
    const audiencesBox = auditingCourseCard
      .getByTestId("content-display-box")
      .filter({ hasText: "Audiences" })

    await expect(descriptionBox.getByText("Course for viewing")).toBeVisible()
    await expect(prerequisitesBox.getByText("Not set")).toBeVisible()
    await expect(audiencesBox.getByText("Not set")).toBeVisible()

    await auditingCourseCard.getByRole("button", { name: "Edit" }).click()

    await auditingCourseCard.getByRole("textbox", { name: "Description" }).click()
    await auditingCourseCard.getByRole("textbox", { name: "Description" }).press("ControlOrMeta+a")
    await auditingCourseCard
      .getByRole("textbox", { name: "Description" })
      .fill("Replaced description for Introduction to course auditing.")

    await auditingCourseCard.getByRole("button", { name: "Add new prerequisite" }).click()
    await auditingCourseCard
      .getByRole("textbox", { name: "Prerequisite" })
      .fill("Knowledge about course editing")

    await auditingCourseCard.getByRole("button", { name: "Add new audience" }).click()
    await auditingCourseCard.getByRole("textbox", { name: "Audience" }).fill("Admins")
    await auditingCourseCard.getByRole("button", { name: "Add new prerequisite" }).click()
    await auditingCourseCard
      .getByRole("textbox", { name: "Prerequisite 2" })
      .fill("Global permissions")

    await auditingCourseCard.getByRole("checkbox", { name: "Set course closed at" }).check()
    await auditingCourseCard.getByRole("spinbutton", { name: "year, Closed at" }).click()
    await page.keyboard.type("202606060606")

    await auditingCourseCard
      .getByRole("textbox", { name: "Additional message on the" })
      .fill(ADDITIONAL_MESSAGE)

    await auditingCourseCard
      .getByRole("textbox", { name: "Closed course successor" })
      .fill("da099841-4e90-4080-a6ae-48b7dd1f6e26")

    const defaultModuleFields = auditingCourseCard
      .getByTestId("edit-module-fields")
      .filter({ hasText: "Default module" })

    await defaultModuleFields
      .getByRole("textbox", { name: "University of Helsinki course code" })
      .fill("TEST001")

    await defaultModuleFields
      .getByRole("checkbox", { name: "Override completion registration link" })
      .check()

    await defaultModuleFields
      .getByRole("textbox", { name: "Completion registration link" })
      .fill("https://www.example.com/override")

    await defaultModuleFields
      .getByRole("checkbox", {
        name: "Enable registering completion to the Open University of University of Helsinki",
      })
      .check()

    await defaultModuleFields.getByRole("spinbutton", { name: "ECTS credits" }).fill("3")

    await auditingCourseCard
      .getByTestId("edit-module-fields")
      .filter({ hasText: "Another module" })
      .getByRole("checkbox", {
        name: "Enable registering completion to the Open University of University of Helsinki",
      })
      .check()

    await auditingCourseCard
      .getByTestId("edit-module-fields")
      .filter({ hasText: "Another module" })
      .getByRole("spinbutton", { name: "ECTS credits" })
      .fill("4")

    await waitForSuccessNotification(
      page,
      async () => {
        await page.getByRole("button", { name: "Save" }).click()
      },
      "Course edited successfully",
    )

    await expect(
      descriptionBox.getByText("Replaced description for Introduction to course auditing.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      prerequisitesBox.getByText("Knowledge about course editing", { exact: true }),
    ).toBeVisible()
    await expect(prerequisitesBox.getByText("Global permissions", { exact: true })).toBeVisible()
    await expect(audiencesBox.getByText("Admins", { exact: true })).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("content-display-box")
        .filter({ hasText: "Closed at" })
        .getByText("2026-06-06 06:06:00", { exact: true }),
    ).toBeVisible()
    await expect(
      auditingCourseCard
        .getByTestId("content-display-box")
        .filter({ hasText: "Closed course successor ID" })
        .getByText("da099841-4e90-4080-a6ae-48b7dd1f6e26", { exact: true }),
    ).toBeVisible()
    await expect(
      auditingCourseCard
        .getByTestId("content-display-box")
        .filter({ hasText: "Additional message on the closed course notification" })
        .getByText(ADDITIONAL_MESSAGE, { exact: true }),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("content-display-box")
        .filter({ hasText: "Additional message on the closed course notification" })
        .getByText(ADDITIONAL_MESSAGE, { exact: true }),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("module-display-field-set")
        .filter({ hasText: "Default module" })
        .getByTestId("content-display-box")
        .filter({
          hasText: "Enable registering completion to the Open University of University of Helsinki",
        })
        .getByText("True"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("module-display-field-set")
        .filter({ hasText: "Default module" })
        .getByTestId("content-display-box")
        .filter({ hasText: "University of Helsinki course code" })
        .getByText("TEST001"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("module-display-field-set")
        .filter({ hasText: "Default module" })
        .getByTestId("content-display-box")
        .filter({ hasText: "ECTS credits" })
        .getByText("3"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("module-display-field-set")
        .filter({ hasText: "Another module" })
        .getByTestId("content-display-box")
        .filter({ hasText: "ECTS credits" })
        .getByText("4"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("module-display-field-set")
        .filter({ hasText: "Bonus module" })
        .getByTestId("content-display-box")
        .filter({
          hasText: "Enable registering completion to the Open University of University of Helsinki",
        })
        .getByText("False"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("module-display-field-set")
        .filter({ hasText: "Bonus module" })
        .getByTestId("content-display-box")
        .filter({
          hasText: "ECTS credits",
        })
        .getByText("Not set"),
    ).toBeVisible()
  })
})

test("Inserting incorrect or wrong UUID displays proper errors", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Course auditing" }).click()
  await page.getByRole("switch", { name: "Not closed" }).click()

  await page.getByRole("textbox", { name: "Search course" }).fill("auditing")
  await expect(page.getByText("Showing 1 course")).toBeVisible()
  await page.getByRole("button", { name: "Edit" }).click()

  await page.getByRole("checkbox", { name: "Set course closed at" }).check()

  await page
    .getByRole("textbox", { name: "Closed course successor" })
    .fill("2d82812b-199e-4098-8be5")

  await page.getByRole("button", { name: "Save" }).click()

  await expect(page.getByText("Invalid UUID format")).toBeVisible()

  await page.getByRole("textbox", { name: "Closed course successor" }).click()
  await page.getByRole("textbox", { name: "Closed course successor" }).press("ControlOrMeta+a")

  await page
    .getByRole("textbox", { name: "Closed course successor" })
    .fill("2d82812b-199e-4098-8be5-99c313597e1b")

  await expect(page.getByText("Invalid UUID format")).toBeHidden()

  await waitForErrorNotification(
    page,
    async () => {
      await page.getByRole("button", { name: "Save" }).click()
    },
    "Reference does not exist",
  )
  await page.getByRole("button", { name: "Cancel" }).click()

  await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible()
  await page.getByTestId("confirm-dialog-yes-button").click()
})

test("Generating new course metadata successfully after setting default UH course code", async ({
  page,
}) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Course auditing" }).click()
  await expect(page.getByRole("heading", { name: "Course auditing" })).toBeVisible()
  await page.getByRole("switch", { name: "Not closed" }).click()

  await page.getByRole("textbox", { name: "Search course" }).fill("auditing")
  await expect(page.getByText("Showing 1 course")).toBeVisible()

  const descriptionBox = page.getByTestId("content-display-box").filter({ hasText: "Description" })
  const prerequisitesBox = page
    .getByTestId("content-display-box")
    .filter({ hasText: "Prerequisites" })
  const audiencesBox = page.getByTestId("content-display-box").filter({ hasText: "Audiences" })

  await expect(
    descriptionBox.getByText("Replaced description for Introduction to course auditing."),
  ).toBeVisible()
  await expect(prerequisitesBox.getByText("Global permissions")).toBeVisible()
  await expect(audiencesBox.getByText("Admins")).toBeVisible()

  await expect(page.getByRole("button", { name: "Suggest metadata" })).toBeEnabled()
  await page.getByRole("button", { name: "Suggest metadata" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace metadata" }).click()
  })

  await expect(descriptionBox.getByText("Introductory course to containers")).toBeVisible()
  await expect(prerequisitesBox.getByText("No hard prerequisites")).toBeVisible()
  await expect(prerequisitesBox.getByText("Linux operating systems")).toBeVisible()
  await expect(audiencesBox.getByText("everyone")).toBeVisible()
  await expect(
    page
      .getByTestId("module-display-field-set")
      .filter({ hasText: "Default module" })
      .getByTestId("content-display-box")
      .filter({ hasText: "University of Helsinki course code" })
      .getByText("TEST001"),
  ).toBeVisible()
})
