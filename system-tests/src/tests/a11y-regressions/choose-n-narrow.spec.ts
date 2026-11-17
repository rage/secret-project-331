import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe, waitForViewType } from "../../utils/iframeLocators"

test.use({ storageState: "src/states/user@example.com.json" })

test("Choose-N result notice with a long word fits the iframe at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(
    "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/choose-n-exercise",
  )
  await selectCourseInstanceIfPrompted(page)
  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await waitForViewType(frame, "answer-exercise")

  await frame.getByRole("button", { name: "Option 1" }).click()
  await frame.getByRole("button", { name: "Option 3" }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  const notice = frame.getByText("partially correct")
  await expect(notice).toBeVisible()

  // A long unbreakable word, as in real feedback texts ("multiplication").
  const overflow = await notice.evaluate((span) => {
    span.textContent = "Your answer was partially correct. Multiplicationrulesandmoreandmore."
    const box = span.parentElement as HTMLElement
    return { box: box.scrollWidth - box.clientWidth, doc: document.documentElement.scrollWidth }
  })
  expect(overflow.box).toBeLessThanOrEqual(0)
  expect(overflow.doc).toBeLessThanOrEqual(145)
})
