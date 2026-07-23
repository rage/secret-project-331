import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import { respondToConfirmDialog } from "../utils/dialogs"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

const FRONT_PAGE_URL = "http://project-331.local/"
const COURSE_URL = "http://project-331.local/org/uh-cs/courses/introduction-to-everything"
const COURSE_NAME = "Introduction to everything"
const HIDE_BUTTON_NAME = `Hide course '${COURSE_NAME}'`

test.use({
  storageState: "src/states/student1@example.com.json",
})

test("hidden course leaves My courses and returns after visiting its material", async ({
  page,
  headless,
}, testInfo) => {
  test.slow()

  // Enroll so the course appears in the "My courses" grid on the front page.
  await page.goto(COURSE_URL)
  await selectCourseInstanceIfPrompted(page)

  await page.goto(FRONT_PAGE_URL)
  await expect(page.getByRole("heading", { name: "My courses" })).toBeVisible()
  const hideButton = page.getByRole("button", { name: HIDE_BUTTON_NAME })
  await expect(hideButton).toBeVisible()

  // Clicking hide opens the confirm dialog (screenshot also captures the button on the card behind it).
  await hideButton.click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "hide-course-confirmation-dialog",
    waitForTheseToBeVisibleAndStable: [page.getByText("Hide course?")],
  })

  // Confirming hides the course: its card is removed from the grid.
  await respondToConfirmDialog(page, true, undefined, "Hide course?")
  await expect(hideButton).toHaveCount(0)

  // Visiting the course material reveals the course in "My courses" again.
  await page.goto(COURSE_URL)
  await selectCourseInstanceIfPrompted(page)

  await page.goto(FRONT_PAGE_URL)
  await expect(page.getByRole("button", { name: HIDE_BUTTON_NAME })).toBeVisible()
})
