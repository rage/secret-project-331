import { expect, test } from "@playwright/test"

import { DateTimeLocalField } from "@/utils/components/DateTimeLocalField"
import { Select } from "@/utils/components/Select"
import { respondToConfirmDialog } from "@/utils/dialogs"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const ADDITIONAL_MESSAGE = "THIS COURSE HAS CLOSED UNTIL FURTHER NOTICE"

const SUCCESSOR_COURSE_ID = "da099841-4e90-4080-a6ae-48b7dd1f6e26"
const SUCCESSOR_COURSE_NAME = "Introduction to codes"

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

    await auditingCourseCard.getByRole("checkbox", { name: "Test course" }).check()
    await auditingCourseCard.getByRole("checkbox", { name: "Joinable by code only" }).check()
    await auditingCourseCard
      .getByRole("switch", { name: "Close the course automatically" })
      .setChecked(true)
    await new DateTimeLocalField(page, "closed-at-field").setValue("2099-06-06T06:06")
    await expect(auditingCourseCard.getByTestId("course-closing-status")).toContainText(
      "Open until 2099-06-06 06:06",
    )

    await auditingCourseCard
      .getByRole("textbox", { name: "Note for students" })
      .fill(ADDITIONAL_MESSAGE)

    const successorSelect = new Select(
      page,
      auditingCourseCard.getByTestId("closed-successor-field"),
      {
        name: "Newer version",
      },
    )
    await successorSelect.search("codes")
    await successorSelect.chooseOptionByValue(SUCCESSOR_COURSE_ID)

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

    await defaultModuleFields.getByRole("textbox", { name: "ECTS credits" }).fill("3")

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
      .getByRole("textbox", { name: "ECTS credits" })
      .fill("4")

    await waitForSuccessNotification(
      page,
      async () => {
        await page.getByRole("button", { name: "Save" }).click()
      },
      "Course edited successfully",
    )

    await expect(auditingCourseCard.getByText("Test course", { exact: true })).toBeVisible()
    await expect(
      auditingCourseCard.getByText("Joinable by code only", { exact: true }),
    ).toBeVisible()

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
        .filter({ hasText: "Closing time" })
        .getByText("Open until 2099-06-06 06:06"),
    ).toBeVisible()
    await expect(
      auditingCourseCard
        .getByTestId("content-display-box")
        .filter({ hasText: "Newer version of the course" })
        .getByRole("link", { name: SUCCESSOR_COURSE_NAME, exact: true }),
    ).toBeVisible()
    await expect(
      auditingCourseCard
        .getByTestId("content-display-box")
        .filter({ hasText: "Note for students" })
        .getByText(ADDITIONAL_MESSAGE, { exact: true }),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByTestId("content-display-box")
        .filter({ hasText: "Note for students" })
        .getByText(ADDITIONAL_MESSAGE, { exact: true }),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByRole("group", { name: "Default module" })
        .getByTestId("content-display-box")
        .filter({
          hasText: "Enable registering completion to the Open University of University of Helsinki",
        })
        .getByText("True"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByRole("group", { name: "Default module" })
        .getByTestId("content-display-box")
        .filter({ hasText: "University of Helsinki course code" })
        .getByText("TEST001"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByRole("group", { name: "Default module" })
        .getByTestId("content-display-box")
        .filter({ hasText: "ECTS credits" })
        .getByText("3"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByRole("group", { name: "Another module" })
        .getByTestId("content-display-box")
        .filter({ hasText: "ECTS credits" })
        .getByText("4"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByRole("group", { name: "Bonus module" })
        .getByTestId("content-display-box")
        .filter({
          hasText: "Enable registering completion to the Open University of University of Helsinki",
        })
        .getByText("False"),
    ).toBeVisible()

    await expect(
      auditingCourseCard
        .getByRole("group", { name: "Bonus module" })
        .getByTestId("content-display-box")
        .filter({
          hasText: "ECTS credits",
        })
        .getByText("Not set"),
    ).toBeVisible()
  })

  test("Choosing a newer version from the closing dropdown", async ({ page }) => {
    await page.goto("http://project-331.local/")
    await page.getByRole("link", { name: "Course auditing" }).click()
    await page.getByRole("switch", { name: "Not closed" }).click()

    await page.getByRole("textbox", { name: "Search course" }).fill("auditing")
    await expect(page.getByText("Showing 1 course")).toBeVisible()
    await page.getByRole("button", { name: "Edit" }).click()

    await page.getByRole("switch", { name: "Close the course automatically" }).setChecked(true)

    const successorTrigger = page.getByTestId("closed-successor-field")
    const successorSelect = new Select(page, successorTrigger, { name: "Newer version" })
    await successorSelect.search("introduction-to-course-auditing")
    await successorSelect.expectNoOptions()
    await successorSelect.close()

    await successorSelect.search("codes")
    await successorSelect.chooseOptionByValue(SUCCESSOR_COURSE_ID)
    await expect(successorTrigger).toContainText(SUCCESSOR_COURSE_NAME)

    await page.getByRole("button", { name: "Cancel" }).click()

    await respondToConfirmDialog(
      page,
      true,
      "You have unsaved changes in this course. Leave without saving?",
    )

    await expect(successorTrigger).toBeHidden()
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

    const descriptionBox = page
      .getByTestId("content-display-box")
      .filter({ hasText: "Description" })
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
        .getByRole("group", { name: "Default module" })
        .getByTestId("content-display-box")
        .filter({ hasText: "University of Helsinki course code" })
        .getByText("TEST001"),
    ).toBeVisible()
  })

  test("Filtering courses by status", async ({ page }) => {
    await page.goto("http://project-331.local/")
    await page.getByRole("link", { name: "Course auditing" }).click()
    await expect(page.getByRole("heading", { name: "Course auditing" })).toBeVisible()
    await page.getByRole("switch", { name: "Not closed" }).click()

    await page
      .getByRole("radiogroup", { name: "Joinable by code only" })
      .getByLabel("Include", { exact: true })
      .click()

    await expect(
      page.getByRole("heading", { name: "Introduction to course auditing", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Joinable by code only", exact: true }),
    ).toBeVisible()

    await page.getByRole("radiogroup", { name: "Test course" }).getByLabel("Include").click()

    await expect(
      page.getByRole("heading", { name: "Joinable by code only", exact: true }),
    ).toBeHidden()

    await page.getByRole("radiogroup", { name: "Test course" }).getByLabel("Exclude").click()

    await expect(
      page.getByRole("heading", { name: "Introduction to course auditing", exact: true }),
    ).toBeHidden()
  })
})
