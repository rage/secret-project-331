import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import { withViewportSize } from "../../utils/viewportUtils"

// WCAG 1.4.10 (Reflow): at 320px CSS width, content must not require scrolling in two dimensions.
// This test pins the pre-existing responsive behavior of StandardDialog-based dialogs by
// opening a real StandardDialog and asserting it fits within the narrow viewport.
const NARROW_VIEWPORT = { width: 320, height: 800 }

test.describe("Dialog narrow screen accessibility", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test("StandardDialog reflows at 320px without horizontal scrolling", async ({ page }) => {
    test.slow()
    // Navigate to a page that opens a StandardDialog at the default viewport. The material
    // reference "Add new reference" dialog is a StandardDialog whose seed data is created by
    // material-reference.spec.ts, so it is reliably reachable here.
    await page.goto("http://project-331.local/organizations")

    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )

    await page
      .locator("[aria-label=\"Manage course \\'Material references course\\'\"] svg")
      .click()
    await page.getByRole("tab", { name: "Other" }).click()
    await page.getByRole("tab", { name: "References" }).click()
    await page.getByText("Add new reference").waitFor()

    await withViewportSize(page, NARROW_VIEWPORT, async () => {
      await page.getByText("Add new reference").click()

      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()

      const submitButton = dialog.getByRole("button", { name: "Submit" })
      await expect(submitButton).toBeVisible()

      await test.step("Dialog width fits within the 320px viewport", async () => {
        const dialogBox = await dialog.boundingBox()
        expect(dialogBox).not.toBeNull()
        // safe: guarded by the not-null assertion above
        expect(dialogBox!.width).toBeLessThanOrEqual(NARROW_VIEWPORT.width)
      })

      await test.step("Page does not scroll horizontally", async () => {
        const hasHorizontalScroll = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        )
        expect(hasHorizontalScroll).toBe(false)
      })

      await test.step("Primary action button is fully within the viewport", async () => {
        const buttonBox = await submitButton.boundingBox()
        expect(buttonBox).not.toBeNull()
        const innerSize = await page.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
        }))
        // safe: guarded by the not-null assertion above
        expect(buttonBox!.x).toBeGreaterThanOrEqual(0)
        expect(buttonBox!.y).toBeGreaterThanOrEqual(0)
        expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(innerSize.width)
        expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(innerSize.height)
      })
    })
  })
})
