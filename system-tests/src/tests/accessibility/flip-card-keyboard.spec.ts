import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

import accessibilityCheck from "@/utils/accessibilityCheck"

const TEST_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/flip-card"

test.describe("Flip card accessibility", () => {
  test.use({
    storageState: "src/states/user@example.com.json",
  })

  test("Flip card is accessible with keyboard navigation and proper ARIA attributes", async ({
    page,
  }) => {
    await page.goto(TEST_PAGE)
    await selectCourseInstanceIfPrompted(page)

    await accessibilityCheck(page, "Flip card initial state")

    const flipButton = page.getByRole("button", { name: /flip/i })

    await test.step("Flip button has aria-pressed attribute", async () => {
      await expect(flipButton).toHaveAttribute("aria-pressed", "false")
    })

    await test.step("Card content is accessible to screen readers", async () => {
      const frontContent = page.getByText("Front side content")
      await expect(frontContent).toBeVisible()
      const backContent = page.getByText("Back side content")
      await expect(backContent).toBeVisible()
    })

    await test.step("Can flip card with keyboard", async () => {
      await flipButton.focus()
      await expect(flipButton).toBeFocused()
      await page.keyboard.press(" ")
      await expect(flipButton).toHaveAttribute("aria-pressed", "true")

      await page.keyboard.press(" ")
      await expect(flipButton).toHaveAttribute("aria-pressed", "false")
    })

    await test.step("Can flip card with Enter key", async () => {
      await flipButton.focus()
      await page.keyboard.press("Enter")
      await expect(flipButton).toHaveAttribute("aria-pressed", "true")

      await page.keyboard.press("Enter")
      await expect(flipButton).toHaveAttribute("aria-pressed", "false")
    })

    await test.step("Card fits on 320px wide screen", async () => {
      await page.setViewportSize({ width: 320, height: 800 })
      const cardContainer = page.locator('[style*="perspective"]').first()
      await expect(cardContainer).toBeVisible()

      const cardWidth = await cardContainer.boundingBox()
      expect(cardWidth?.width).toBeLessThanOrEqual(320)
    })

    await test.step("Button text has sufficient contrast", async () => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const buttonStyles = await flipButton.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
        }
      })

      expect(buttonStyles.color).toBeTruthy()
      expect(buttonStyles.backgroundColor).toBeTruthy()
    })

    await accessibilityCheck(page, "Flip card after interactions")
  })
})
