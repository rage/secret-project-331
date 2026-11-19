import { expect, test } from "@playwright/test"

import { Checkbox } from "@/utils/components/Checkbox"
import {
  languageVersionsTabUrl,
  problemRow,
  SPLIT_SET,
  storageStateOf,
} from "@/utils/languageVersions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

// Owns the "split" set.
test.use({ storageState: storageStateOf(SPLIT_SET.teacherEmail) })

test("Removing a course from the language versions moves its students with it", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto(languageVersionsTabUrl(SPLIT_SET.finnishCourseId))
  const courses = page.getByRole("table", { name: "Courses" })
  await expect(courses.getByRole("link", { name: SPLIT_SET.swedishName })).toBeVisible()

  await page
    .getByRole("button", { name: `Remove ${SPLIT_SET.swedishName} from the language versions` })
    .click()
  const dialog = page.getByRole("dialog", {
    name: `Remove “${SPLIT_SET.swedishName}” from the language versions`,
  })
  await expect(
    dialog.getByText("1 student’s enrolment will move with this course", { exact: true }),
  ).toBeVisible()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: dialog,
    headless,
    testInfo,
    snapshotName: "language-versions-split-preview",
    waitForTheseToBeVisibleAndStable: [dialog.getByText("What else changes")],
  })

  const confirm = dialog.getByRole("button", { name: "Remove from language versions" })
  await expect(confirm).toBeDisabled()
  await Checkbox.labelled(
    page,
    "I understand that 1 student’s enrolment, completions and consents will move with this course.",
    dialog,
  ).setChecked(true)
  await confirm.click()
  await expect(dialog).toBeHidden()

  await expect(courses.getByRole("link", { name: SPLIT_SET.swedishName })).toHaveCount(0)
  await expect(page.getByText("This course has no other language versions yet.")).toBeVisible()
  await expect(
    problemRow(page, "2 courses look like translations of this course but are separate courses"),
  ).toContainText(`“${SPLIT_SET.swedishName}” (Swedish)`)
})
