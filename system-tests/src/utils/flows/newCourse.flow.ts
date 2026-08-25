import type { Locator, Page } from "@playwright/test"

/**
 * Values for the shared new-course form. The same form backs both the "New course" dialog on an
 * organization page and the new language version dialog on a course's "Language versions" tab, so
 * a few of the fields only exist in one of them.
 */
export interface NewCourseOptions {
  name: string
  /** Label of the "Course language" radio to select, e.g. "English" or "Finnish". */
  language: string
  teacherInChargeName: string
  teacherInChargeEmail: string
  /** Filled only when given, since the description field is optional in the form. */
  description?: string
  /**
   * Id of the course to copy the content from. Checks "Copy content from another course" and picks
   * the course from the selector that appears. Only offered by the "New course" dialog.
   */
  copyContentFromCourseId?: string
  /** Checks "Grant access to this course to everyone who had access to the original one". */
  grantAccessToOriginalUsers?: boolean
}

/**
 * Fills and submits the new-course form inside the given dialog, then waits for the dialog to close.
 *
 * Every locator is scoped to the dialog and addressed by role or accessible name. The pages this
 * form opens on have "Create" buttons and form fields of their own, and the modal backdrop makes
 * everything behind the dialog unclickable, so a selector that can reach outside the dialog either
 * drives the wrong control or times out.
 */
async function fillNewCourseForm(dialog: Locator, options: NewCourseOptions): Promise<void> {
  if (options.copyContentFromCourseId !== undefined) {
    await dialog.getByLabel("Copy content from another course").check()
    await dialog
      .locator("#duplicate-course-select-menu")
      .selectOption(options.copyContentFromCourseId)
  }
  if (options.grantAccessToOriginalUsers) {
    await dialog
      .getByLabel("Grant access to this course to everyone who had access to the original one")
      .check()
  }

  await dialog.getByLabel(options.language).check()
  await dialog.getByLabel("Name  *", { exact: true }).fill(options.name)
  await dialog.getByLabel("Teacher in charge name  *").fill(options.teacherInChargeName)
  await dialog.getByLabel("Teacher in charge email  *").fill(options.teacherInChargeEmail)
  if (options.description !== undefined) {
    await dialog.getByRole("textbox", { name: "Description" }).fill(options.description)
  }

  await dialog.getByRole("button", { name: "Create" }).click()
  await dialog.waitFor({ state: "hidden" })
}

/**
 * Creates a course from the course list of the organization page the browser is currently on.
 *
 * The organization page renders a "Create" button for courses and another one for exams, and the
 * two sections load independently. An unscoped "Create" locator therefore opens whichever dialog's
 * section happened to resolve first, and the following steps then wait out their action timeout
 * looking for fields of the other form. Anchor the click to the course list region instead.
 */
export async function createCourse(page: Page, options: NewCourseOptions): Promise<void> {
  await page
    .getByRole("region", { name: "Courses" })
    .getByRole("button", { name: "Create", exact: true })
    .click()

  const dialog = page.getByRole("dialog", { name: "New course" })
  await dialog.waitFor()

  await fillNewCourseForm(dialog, options)
}

/**
 * Creates a new language version of `courseName`. Expects the browser to be on that course's
 * "Language versions" management tab.
 */
export async function createCourseLanguageVersion(
  page: Page,
  courseName: string,
  options: NewCourseOptions,
): Promise<void> {
  await page.getByRole("button", { name: "New", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: `Create new language version of ${courseName}` })
  await dialog.waitFor()

  await fillNewCourseForm(dialog, options)
}
