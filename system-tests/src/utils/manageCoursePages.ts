import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { Menu } from "./components/Menu"
import { submitDialog } from "./dialogs"
import { tableRowByCell } from "./tableRows"

/**
 * Where a page lives in the course's "Pages" tab: a chapter by its number, or the top-level pages
 * that belong to no chapter.
 */
export type CoursePageSection = { chapterNumber: number } | "top-level"

const TOP_LEVEL = "top-level"
const NEW_PAGE_BUTTON_XPATH = `xpath=ancestor::*[.//button[normalize-space()="New page"]][1]`

/**
 * The block of the "Pages" tab holding one section's page tables and its "New page" button.
 *
 * Found through the section's heading rather than by counting "New page" buttons, which shift
 * whenever a chapter is added before the one a spec means.
 */
export function coursePageSection(page: Page, section: CoursePageSection): Locator {
  const heading =
    section === TOP_LEVEL
      ? page.getByRole("heading", { name: "Top level pages", exact: true })
      : chapterHeading(page, section.chapterNumber)
  return heading.locator(NEW_PAGE_BUTTON_XPATH)
}

/** The actions menu (edit, delete, …) in chapter `chapterNumber`'s heading. */
export function chapterActionsMenu(page: Page, chapterNumber: number): Menu {
  return new Menu(
    page,
    chapterHeading(page, chapterNumber).getByRole("button", { name: "Dropdown menu" }),
    { name: `Chapter ${chapterNumber} actions` },
  )
}

/**
 * The actions menu (edit details, delete, …) on the page-list row of the page titled `title`.
 *
 * Pass `section` when another section has a page with the same title.
 */
export function coursePageActionsMenu(
  page: Page,
  title: string,
  section?: CoursePageSection,
): Menu {
  const scope = section === undefined ? page : coursePageSection(page, section)
  return new Menu(
    page,
    tableRowByCell(scope, title).getByRole("button", { name: "Dropdown menu" }),
    { name: `Page "${title}" actions` },
  )
}

function chapterHeading(page: Page, chapterNumber: number): Locator {
  return page
    .getByRole("heading", { level: 2 })
    .filter({ hasText: new RegExp(`^Chapter ${chapterNumber}:`) })
}

/**
 * Creates a chapter named `name` through the "New chapter" dialog, with the number the dialog
 * proposes, and waits for its section to appear.
 */
export async function createCourseChapter(page: Page, name: string): Promise<void> {
  await test.step(`Create chapter "${name}"`, async () => {
    await page.getByRole("button", { name: "New chapter", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "New chapter" })
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name)
    await submitDialog(dialog, "Create")
    await expect(
      page.getByRole("heading", { level: 2 }).filter({ hasText: `: ${name}` }),
    ).toBeVisible()
  })
}

/** Creates a page titled `title` in `section` through the "New page" dialog, and waits for its row. */
export async function createCoursePage(
  page: Page,
  section: CoursePageSection,
  title: string,
): Promise<void> {
  await test.step(`Create page "${title}"`, async () => {
    const sectionLocator = coursePageSection(page, section)
    await sectionLocator.getByRole("button", { name: "New page", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "New page" })
    await dialog.getByRole("textbox", { name: "Title", exact: true }).fill(title)
    await submitDialog(dialog, "Create")
    await expect(tableRowByCell(sectionLocator, title)).toBeVisible()
  })
}

/**
 * Opens the page titled `title` from the "Pages" tab in the CMS editor.
 *
 * Pass `section` when another section has a page with the same title.
 */
export async function openCoursePageInEditor(
  page: Page,
  title: string,
  section?: CoursePageSection,
): Promise<void> {
  const scope = section === undefined ? page : coursePageSection(page, section)

  await test.step(`Open page "${title}" in the editor`, async () => {
    await tableRowByCell(scope, title)
      .getByRole("button", { name: "Edit page", exact: true })
      .click()
    await page.waitForURL(/\/cms\/pages\//)
  })
}
