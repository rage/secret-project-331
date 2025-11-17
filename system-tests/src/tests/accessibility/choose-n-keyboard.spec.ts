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

    const buttons = quizzesIframe.getByRole("button")
    const buttonCount = await buttons.count()
    expect(buttonCount).toBeGreaterThanOrEqual(2)

    const firstButton = buttons.first()
    const secondButton = buttons.nth(1)
    const thirdButton = buttonCount >= 3 ? buttons.nth(2) : null

    await test.step("Buttons have aria-pressed attribute", async () => {
      await expect(firstButton).toHaveAttribute("aria-pressed", "false")
      await expect(secondButton).toHaveAttribute("aria-pressed", "false")
      if (thirdButton) {
        await expect(thirdButton).toHaveAttribute("aria-pressed", "false")
      }
    })

    await test.step("Can navigate and select options with keyboard", async () => {
      await firstButton.focus()
      await expect(firstButton).toBeFocused()
      await page.keyboard.press(" ")
      await expect(firstButton).toHaveAttribute("aria-pressed", "true")

      await page.keyboard.press("Tab")
      await expect(secondButton).toBeFocused()
      await page.keyboard.press(" ")
      await expect(secondButton).toHaveAttribute("aria-pressed", "true")

      if (thirdButton) {
        await page.keyboard.press("Tab")
        await expect(thirdButton).toBeFocused()
      }
    })

    await test.step("All buttons remain focusable when limit is reached", async () => {
      if (thirdButton) {
        await page.keyboard.press(" ")
        await expect(thirdButton).toHaveAttribute("aria-pressed", "true")
      }

      await page.keyboard.press("Shift+Tab")
      await expect(secondButton).toBeFocused()
      await expect(secondButton).toBeEnabled()

      await page.keyboard.press("Shift+Tab")
      await expect(firstButton).toBeFocused()
      await expect(firstButton).toBeEnabled()
    })

    await test.step("Aria-live announcement when trying to select more than allowed", async () => {
      await page.keyboard.press("Tab")
      if (thirdButton) {
        await expect(thirdButton).toBeFocused()
      } else {
        await expect(secondButton).toBeFocused()
      }

      const liveRegion = quizzesIframe.locator('[aria-live="polite"]')
      await expect(liveRegion).toBeVisible()

      await page.keyboard.press(" ")
      await page.waitForTimeout(100)
      const announcementText = await liveRegion.textContent()
      expect(announcementText).toContain("You have already chosen")
      expect(announcementText).toContain("Please remove a choice")
    })

    await test.step("Can deselect options to choose different ones", async () => {
      await firstButton.click()
      await expect(firstButton).toHaveAttribute("aria-pressed", "false")

      if (thirdButton) {
        await thirdButton.click()
        await expect(thirdButton).toHaveAttribute("aria-pressed", "false")
      }

      await secondButton.click()
      await expect(secondButton).toHaveAttribute("aria-pressed", "false")

      await firstButton.click()
      await expect(firstButton).toHaveAttribute("aria-pressed", "true")
    })

    await accessibilityCheck(page, "Choose N after interactions")
  })
})
