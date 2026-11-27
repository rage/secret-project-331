import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe, waitForViewType } from "../../utils/iframeLocators"

// Submits the exercise, so it has its own student: the other Choose N tests need it unanswered.
test.use({ storageState: "src/states/student8@example.com.json" })

test("Choose-N answer summary with a long word fits the iframe at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(
    "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/choose-n-exercise",
  )
  await selectCourseInstanceIfPrompted(page)
  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await waitForViewType(frame, "answer-exercise")

  await frame.getByRole("button", { name: "Option 1" }).click()
  await frame.getByRole("button", { name: "Option 2" }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  // Full points release the key, which the summary needs.
  const summary = frame.getByRole("group", { name: "Answer summary" })
  await expect(summary).toBeVisible()

  // A long unbreakable word, as in real option texts ("multiplication").
  const overflow = await summary.evaluate((box) => {
    const line = box.querySelector("p") as HTMLElement
    line.textContent = "Multiplicationrulesandmoreandmoreandmoreandmoreandmoreandmoreandmore."
    return {
      box: box.scrollWidth - box.clientWidth,
      doc: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  expect(overflow.box).toBeLessThanOrEqual(0)
  expect(overflow.doc).toBeLessThanOrEqual(0)
})
