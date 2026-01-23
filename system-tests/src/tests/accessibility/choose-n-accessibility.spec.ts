import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe, waitForViewType } from "../../utils/iframeLocators"

import accessibilityCheck from "@/utils/accessibilityCheck"

const TEST_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/choose-n-exercise"

test.describe("Choose N exercise accessibility", () => {
  test.use({
    storageState: "src/states/user@example.com.json",
  })

  test("Choose N buttons are accessible with keyboard navigation and aria-pressed states", async ({
    page,
  }) => {
    await page.goto(TEST_PAGE)
    await selectCourseInstanceIfPrompted(page)

    const quizzesIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
    await waitForViewType(quizzesIframe, "answer-exercise")

    await accessibilityCheck(page, "Choose N initial state")

    const firstButton = quizzesIframe.getByRole("button", { name: "Option 1" })
    const secondButton = quizzesIframe.getByRole("button", { name: "Option 2" })
    const thirdButton = quizzesIframe.getByRole("button", { name: "Option 3" })

    await test.step("Buttons have aria-pressed attribute", async () => {
      await expect(firstButton).toHaveAttribute("aria-pressed", "false")
      await expect(secondButton).toHaveAttribute("aria-pressed", "false")
      await expect(thirdButton).toHaveAttribute("aria-pressed", "false")
    })

    await test.step("Can navigate and select options with keyboard", async () => {
      await firstButton.focus()
      await expect(firstButton).toBeFocused()
      await page.keyboard.press(" ")
      await expect(firstButton).toHaveAttribute("aria-pressed", "true")

      await page.keyboard.press("ArrowRight")
      await expect(secondButton).toBeFocused()
      await page.keyboard.press(" ")
      await expect(secondButton).toHaveAttribute("aria-pressed", "true")
    })

    await test.step("All buttons remain focusable when limit is reached", async () => {
      await page.keyboard.press("ArrowRight")
      await expect(thirdButton).toBeFocused()
      await expect(thirdButton).toBeEnabled()

      await page.keyboard.press("ArrowLeft")
      await expect(secondButton).toBeFocused()
      await expect(secondButton).toBeEnabled()

      await page.keyboard.press("ArrowLeft")
      await expect(firstButton).toBeFocused()
      await expect(firstButton).toBeEnabled()
    })

    await test.step("Visible announcement when trying to select more than allowed", async () => {
      await page.keyboard.press("ArrowRight")
      await page.keyboard.press("ArrowRight")
      await expect(thirdButton).toBeFocused()
      await expect(thirdButton).toHaveAttribute("aria-pressed", "false")

      await page.keyboard.press(" ")
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await page.waitForTimeout(100)

      const liveRegion = quizzesIframe.locator('[aria-live="polite"]')
      await expect(liveRegion).toBeVisible()
      const announcementText = await liveRegion.textContent()
      expect(announcementText).toContain("You have already chosen")
      expect(announcementText).toContain("Please remove a choice")
      await expect(thirdButton).toHaveAttribute("aria-pressed", "false")
    })

    await test.step("Can deselect options to choose different ones", async () => {
      await firstButton.click()
      await expect(firstButton).toHaveAttribute("aria-pressed", "false")

      await secondButton.click()
      await expect(secondButton).toHaveAttribute("aria-pressed", "false")

      await thirdButton.click()
      await expect(thirdButton).toHaveAttribute("aria-pressed", "true")

      await firstButton.click()
      await expect(firstButton).toHaveAttribute("aria-pressed", "true")
    })

    await accessibilityCheck(page, "Choose N after interactions")
  })
})
