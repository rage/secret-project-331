import { expect, test } from "@playwright/test"

import { Checkbox } from "@/utils/components/Checkbox"
import { Topbar } from "@/utils/components/Topbar"
import {
  coursePageUrl,
  JOIN_SET,
  languageVersionsTabUrl,
  storageStateOf,
} from "@/utils/languageVersions"
import { hideToasts } from "@/utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

// Owns the "join" set. Each test builds on the previous one.
test.describe.configure({ mode: "serial" })

const PAGE_PATH = "/chapter-1/muuttujat"
const hideCourseButton = (name: string) => `Hide course '${name}'`

test.describe("Before the join", () => {
  test.use({ storageState: storageStateOf(JOIN_SET.studentInBothEmail) })

  test("The student is enrolled in the Finnish and the English course", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("button", { name: hideCourseButton(JOIN_SET.finnishName) }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: hideCourseButton(JOIN_SET.englishName) }),
    ).toBeVisible()
  })
})

test.describe("The teacher", () => {
  test.use({ storageState: storageStateOf(JOIN_SET.teacherEmail) })

  test("Joins the English course with its students and links its pages", async ({
    page,
    headless,
  }, testInfo) => {
    await page.goto(languageVersionsTabUrl(JOIN_SET.finnishCourseId))
    await page.getByRole("button", { name: "Add an existing course" }).click()

    const dialog = page.getByRole("dialog", {
      name: "Add an existing course as a language version",
    })
    await dialog.getByRole("radio", { name: JOIN_SET.englishName }).check()
    await dialog.getByRole("button", { name: "Continue" }).click()

    await expect(dialog.getByText("2 students’ course data will move")).toBeVisible()
    await expect(dialog.getByText("1 student is enrolled in both")).toBeVisible()
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: dialog,
      headless,
      testInfo,
      snapshotName: "language-versions-join-preview",
      waitForTheseToBeVisibleAndStable: [dialog.getByRole("table", { name: "What moves" })],
    })
    await dialog.getByRole("button", { name: "Continue" }).click()

    const confirm = dialog.getByRole("button", { name: "Add as a language version" })
    await expect(confirm).toBeDisabled()
    await Checkbox.labelled(
      page,
      "I understand that 2 students’ enrolments, completions and consents will move to these language versions.",
      dialog,
    ).setChecked(true)
    await confirm.click()
    await expect(dialog).toBeHidden()

    await expect(
      page.getByText(`“${JOIN_SET.englishName}” is now a language version of this course.`, {
        exact: false,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("table", { name: "Courses" }).getByRole("link", {
        name: JOIN_SET.englishName,
      }),
    ).toBeVisible()

    await page.getByRole("button", { name: "Check the suggested links" }).click()
    await expect(page.getByRole("heading", { name: "Chapters and pages" })).toBeVisible()
    await page.getByRole("button", { name: "Accept all suggestions" }).click()
    await expect(page.getByRole("button", { name: "Undo accept all" })).toBeVisible()
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "language-versions-guided-pages",
      waitForTheseToBeVisibleAndStable: [page.getByRole("button", { name: "Undo accept all" })],
      beforeScreenshot: () => hideToasts(page),
    })
    // Continue opens each chapter tab in turn before moving on to the next step.
    const reviewHeading = page.getByRole("heading", { name: "Review and apply" })
    while (!(await reviewHeading.isVisible())) {
      await page.getByRole("button", { name: "Continue" }).click()
    }
    await page.getByRole("button", { name: "Apply changes" }).click()
    const applyDialog = page.getByRole("dialog", { name: "Apply the changes" })
    await applyDialog.getByRole("button", { name: "Apply changes" }).click()
    await expect(page.getByText("Changes applied", { exact: true })).toBeVisible()
  })
})

test.describe("After the join", () => {
  test.use({ storageState: storageStateOf(JOIN_SET.studentInBothEmail) })

  test("The student keeps one enrolment and switches language on the same page", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(
      page.getByRole("button", { name: hideCourseButton(JOIN_SET.englishName) }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: hideCourseButton(JOIN_SET.finnishName) }),
    ).toHaveCount(0)

    await page.goto(coursePageUrl(JOIN_SET, JOIN_SET.englishSlug, PAGE_PATH))
    await expect(page.locator("#topbar-language-menu")).toHaveAttribute(
      "aria-label",
      /Change course language/,
    )
    await new Topbar(page).languageMenu.clickItem("Suomi")
    await expect(page).toHaveURL(coursePageUrl(JOIN_SET, JOIN_SET.finnishSlug, PAGE_PATH))
    // The course material is shown in the course's own language.
    await expect(
      page.getByText("Olet jo aloittanut tämän kurssin toisella kielellä").first(),
    ).toBeVisible()
  })
})
