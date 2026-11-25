import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../utils/iframeLocators"

test.use({ storageState: "src/states/user@example.com.json" })

const PAGE =
  "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/choose-n-exercise"

test("Tab from the exercise heading reaches the options inside the iframe (chromium)", async ({
  page,
}) => {
  await page.goto(PAGE)
  await selectCourseInstanceIfPrompted(page)
  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  const first = frame.getByRole("button", { name: "Option 1" })
  // waitFor uses the 15 s action timeout; the iframe loads slowly under full-suite load
  await first.waitFor()

  await page.getByRole("heading", { name: /Choose N exercise/ }).focus()
  await page.keyboard.press("Tab")
  await expect(first).toBeFocused()
})
