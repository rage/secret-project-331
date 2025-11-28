import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { withViewportSize } from "../../utils/viewportUtils"

import accessibilityCheck from "@/utils/accessibilityCheck"

const TEST_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/flip-card"

test.describe.only("Flip card accessibility", () => {
  test.use({
    storageState: "src/states/user@example.com.json",
  })

  test("Flip card is accessible with keyboard navigation and proper ARIA attributes", async ({
    page,
  }) => {
    await page.goto(TEST_PAGE)
    await selectCourseInstanceIfPrompted(page)

    await accessibilityCheck(page, "Flip card initial state")

    const getFlipButton = (isFlipped: boolean) => {
      const buttonLabels = ["Flip to back side of card", "Flip to front side of card"]
      return page.getByRole("button", { name: buttonLabels[Number(isFlipped)] })
    }

    await test.step("Flip button has aria-pressed attribute", async () => {
      const flipButton = getFlipButton(false)
      await expect(flipButton).toHaveAttribute("aria-pressed", "false")
    })

    await test.step("Card content is accessible to screen readers", async () => {
      const frontContent = page.getByTestId("flip-card-front")
      await expect(frontContent).toBeVisible()
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      const backContent = page.getByTestId("flip-card-back")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")
    })

    await test.step("Can flip card with keyboard", async () => {
      const frontContent = page.getByTestId("flip-card-front")
      const backContent = page.getByTestId("flip-card-back")
      const flipButton = getFlipButton(false)

      await flipButton.focus()
      await expect(flipButton).toBeFocused()
      await expect(frontContent).toBeVisible()
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")

      await page.keyboard.press(" ")
      const flippedButton = getFlipButton(true)
      await expect(flippedButton).toHaveAttribute("aria-pressed", "true")
      await expect(frontContent).toHaveAttribute("aria-hidden", "true")
      await expect(backContent).toHaveAttribute("aria-hidden", "false")

      await page.keyboard.press(" ")
      const unflippedButton = getFlipButton(false)
      await expect(unflippedButton).toHaveAttribute("aria-pressed", "false")
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")
    })

    await test.step("Can flip card with Enter key", async () => {
      const frontContent = page.getByTestId("flip-card-front")
      const backContent = page.getByTestId("flip-card-back")
      const flipButton = getFlipButton(false)

      await flipButton.focus()
      await page.keyboard.press("Enter")
      const flippedButton = getFlipButton(true)
      await expect(flippedButton).toHaveAttribute("aria-pressed", "true")
      await expect(frontContent).toHaveAttribute("aria-hidden", "true")
      await expect(backContent).toHaveAttribute("aria-hidden", "false")

      await page.keyboard.press("Enter")
      const unflippedButton = getFlipButton(false)
      await expect(unflippedButton).toHaveAttribute("aria-pressed", "false")
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")
    })

    await test.step("Can flip card by clicking anywhere on the card (pseudo-content trick)", async () => {
      const frontContent = page.getByTestId("flip-card-front")
      const backContent = page.getByTestId("flip-card-back")
      const cardContainer = page.locator('[style*="perspective"]').first()

      await expect(frontContent).toBeVisible()
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")

      await cardContainer.click({ position: { x: 50, y: 50 } })
      const flipButton = getFlipButton(true)
      await expect(flipButton).toHaveAttribute("aria-pressed", "true")
      await expect(frontContent).toHaveAttribute("aria-hidden", "true")
      await expect(backContent).toHaveAttribute("aria-hidden", "false")

      await cardContainer.click({ position: { x: 100, y: 100 } })
      const flipButton2 = getFlipButton(false)
      await expect(flipButton2).toHaveAttribute("aria-pressed", "false")
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")

      await cardContainer.click({ position: { x: 200, y: 150 } })
      const flipButton3 = getFlipButton(true)
      await expect(flipButton3).toHaveAttribute("aria-pressed", "true")
      await expect(frontContent).toHaveAttribute("aria-hidden", "true")
      await expect(backContent).toHaveAttribute("aria-hidden", "false")

      await cardContainer.click({ position: { x: 10, y: 10 } })
      const flipButton4 = getFlipButton(false)
      await expect(flipButton4).toHaveAttribute("aria-pressed", "false")
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")
    })

    await test.step("Button works from back side", async () => {
      const frontContent = page.getByTestId("flip-card-front")
      const backContent = page.getByTestId("flip-card-back")
      const flipButton = getFlipButton(false)

      await flipButton.click()
      const flippedButton = getFlipButton(true)
      await expect(flippedButton).toHaveAttribute("aria-pressed", "true")
      await expect(frontContent).toHaveAttribute("aria-hidden", "true")
      await expect(backContent).toHaveAttribute("aria-hidden", "false")

      await flippedButton.click()
      const unflippedButton = getFlipButton(false)
      await expect(unflippedButton).toHaveAttribute("aria-pressed", "false")
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")
    })

    await test.step("Focus moves to button on visible side after flipping", async () => {
      const frontContent = page.getByTestId("flip-card-front")
      const backContent = page.getByTestId("flip-card-back")
      const flipButton = getFlipButton(false)

      await flipButton.focus()
      await expect(flipButton).toBeFocused()
      await expect(frontContent).toBeVisible()
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")

      await page.keyboard.press(" ")
      const flippedButton = getFlipButton(true)
      await expect(flippedButton).toBeFocused()
      await expect(flippedButton).toHaveAttribute("aria-pressed", "true")
      await expect(frontContent).toHaveAttribute("aria-hidden", "true")
      await expect(backContent).toHaveAttribute("aria-hidden", "false")

      await page.keyboard.press(" ")
      const unflippedButton = getFlipButton(false)
      await expect(unflippedButton).toBeFocused()
      await expect(unflippedButton).toHaveAttribute("aria-pressed", "false")
      await expect(frontContent).toHaveAttribute("aria-hidden", "false")
      await expect(backContent).toHaveAttribute("aria-hidden", "true")
    })

    await accessibilityCheck(page, "Flip card after interactions")

    await test.step("Button text has sufficient contrast", async () => {
      await withViewportSize(page, { width: 1280, height: 800 }, async () => {
        const flipButton = getFlipButton(false)
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
    })

    await test.step("Card fits on 320px wide screen", async () => {
      await withViewportSize(page, { width: 320, height: 800 }, async () => {
        const cardContainer = page.locator('[style*="perspective"]').first()
        await expect(cardContainer).toBeVisible()

        const cardWidth = await cardContainer.boundingBox()
        expect(cardWidth?.width).toBeLessThanOrEqual(320)
      })
    })
  })
})
