import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../utils/iframeLocators"

test.use({ browserName: "chromium", storageState: "src/states/user@example.com.json" })

const PAGE =
  "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/choose-n-exercise"

test("Tab from the exercise heading reaches the options inside the iframe (chromium)", async ({
  page,
}) => {
  await page.goto(PAGE)
  await selectCourseInstanceIfPrompted(page)
  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await expect(frame.getByRole("button", { name: "Option 1" })).toBeVisible()

  await page.getByRole("heading", { name: /Choose N exercise/ }).focus()
  const first = frame.getByRole("button", { name: "Option 1" })
  await page.keyboard.press("Tab")
  await expect(first).toBeFocused()
})
