import { expect, test } from "@playwright/test"

import { Select } from "@/utils/components/Select"
import {
  languageVersionsTabUrl,
  PROBLEMS_SET,
  problemRow,
  storageStateOf,
} from "@/utils/languageVersions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

// Owns the "problems" set. The read-only tests come first; the last two change the set.
test.use({ storageState: storageStateOf(PROBLEMS_SET.teacherEmail) })

const MISSING_PAGE = "1 Finnish page has no Swedish counterpart"
const DUPLICATE_PAGES = "2 Swedish pages are linked to the same page"
const UNLINKED_EXERCISES = "1 Finnish exercise is not linked yet"
const SEPARATE_COURSE = "A course looks like a translation of this course but is a separate course"
const PAGE_ORDER = "The pages of chapter 1 are in a different order in Swedish"

test("The problem list groups the problems of the language versions by severity", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto(languageVersionsTabUrl(PROBLEMS_SET.finnishCourseId))

  const courses = page.getByRole("table", { name: "Courses" })
  await expect(courses.getByRole("link", { name: PROBLEMS_SET.finnishName })).toBeVisible()
  await expect(courses.getByRole("link", { name: PROBLEMS_SET.swedishName })).toBeVisible()
  await expect(courses.getByRole("link", { name: PROBLEMS_SET.englishName })).toHaveCount(0)

  await expect(page.getByRole("heading", { name: "Affects students now" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Should be fixed" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Check whether this is intended" })).toBeVisible()
  for (const title of [
    MISSING_PAGE,
    DUPLICATE_PAGES,
    UNLINKED_EXERCISES,
    SEPARATE_COURSE,
    PAGE_ORDER,
  ]) {
    await expect(problemRow(page, title)).toBeVisible()
  }
  await expect(problemRow(page, SEPARATE_COURSE)).toContainText(
    `“${PROBLEMS_SET.englishName}” (English)`,
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "language-versions-problem-list",
    waitForTheseToBeVisibleAndStable: [problemRow(page, PAGE_ORDER)],
    screenshotOptions: { mask: [page.locator("time")] },
  })
})

test("Exercises without a counterpart show the missing language in the Exercises tab", async ({
  page,
}) => {
  await page.goto(`/manage/courses/${PROBLEMS_SET.finnishCourseId}/exercises`)

  const missing = page.getByRole("button", { name: "No Swedish counterpart" })
  await expect(missing).toHaveCount(1)
  await expect(missing).toHaveText("sv")

  await missing.click()
  await page
    .getByRole("link", { name: "No Swedish counterpart. Link one in Language versions." })
    .click()
  await expect(page).toHaveURL(languageVersionsTabUrl(PROBLEMS_SET.finnishCourseId))
  await expect(problemRow(page, MISSING_PAGE)).toBeVisible()
})

test("The page editor's Language versions view shows the missing counterpart", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto(`/cms/pages/${PROBLEMS_SET.reviewPageId}`)

  const sidebarView = new Select(page, page.locator("#select-sidebar-view"), {
    name: "Toggle view",
  })
  await sidebarView.chooseOption("Language versions")

  const view = page.getByRole("heading", { name: "Language versions", level: 3 }).locator("..")
  await expect(view.getByText("This page", { exact: true })).toBeVisible()
  await expect(view.getByText("Missing", { exact: true })).toBeVisible()
  await expect(view.getByRole("button", { name: "Link an existing page" })).toBeVisible()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: view,
    headless,
    testInfo,
    snapshotName: "language-versions-page-editor-view",
    // The editor sidebar is a desktop layout.
    skipMobile: true,
  })

  await view.getByRole("link", { name: "Create counterpart" }).click()
  await expect(page).toHaveURL(
    `/manage/courses/${PROBLEMS_SET.finnishCourseId}/pages/${PROBLEMS_SET.reviewPageId}/create-counterpart?language=sv`,
  )
  await expect(page.getByText("Page to copy", { exact: true })).toBeVisible()
  await expect(page.getByRole("radio", { name: "Swedish" })).toBeChecked()
})

test("Mark as intended hides a problem until it is reported again", async ({ page }) => {
  await page.goto(languageVersionsTabUrl(PROBLEMS_SET.finnishCourseId))

  const row = problemRow(page, PAGE_ORDER)
  await row.getByRole("button", { name: "Mark as intended" }).click()
  await expect(row.getByText("Marked as intended")).toBeVisible()
  await expect(page.getByText("All done", { exact: true })).toBeVisible()

  const reportRefetched = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" && response.url().endsWith("/language-versions/report"),
  )
  await page.getByRole("button", { name: "Check again" }).click()
  await reportRefetched
  await expect(row.getByText("Marked as intended")).toBeVisible()

  await row.getByRole("button", { name: "Report again" }).click()
  await expect(row.getByRole("button", { name: "Mark as intended" })).toBeVisible()
  await expect(page.getByText("1 to check", { exact: true })).toBeVisible()
})

test("A missing page gets a linked counterpart from the problem's fix", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto(languageVersionsTabUrl(PROBLEMS_SET.finnishCourseId))

  await problemRow(page, MISSING_PAGE).getByRole("button", { name: "Fix" }).click()
  const createOption = page.getByRole("radio", { name: "Create the missing counterpart" })
  const dialog = page.getByRole("dialog").filter({ has: createOption })
  await expect(dialog).toContainText("Kertaus")
  await expect(createOption).toBeChecked()
  await dialog.getByRole("button", { name: "Continue" }).click()

  await expect(page).toHaveURL(
    `/manage/courses/${PROBLEMS_SET.finnishCourseId}/pages/${PROBLEMS_SET.reviewPageId}/create-counterpart?language=sv`,
  )
  await expect(
    page.getByRole("heading", { name: "Create a counterpart in another language" }),
  ).toBeVisible()
  await expect(page.getByRole("radio", { name: "Swedish" })).toBeChecked()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "language-versions-create-counterpart",
    waitForTheseToBeVisibleAndStable: [page.getByText("New page: Kertaus")],
  })

  await page.getByLabel("Page title", { exact: true }).fill("Repetition")
  await page.getByRole("button", { name: "Create and link" }).click()
  await expect(page.getByText("Swedish counterpart created")).toBeVisible()

  await page.goto(languageVersionsTabUrl(PROBLEMS_SET.finnishCourseId))
  await expect(problemRow(page, DUPLICATE_PAGES)).toBeVisible()
  await expect(problemRow(page, MISSING_PAGE)).toHaveCount(0)
  await expect(problemRow(page, UNLINKED_EXERCISES)).toHaveCount(0)
})
