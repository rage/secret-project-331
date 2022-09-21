import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test quizzes timeline feedback", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/the-timeline",
  )

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "timeline-initial",
    scrollToYCoordinate: 470,
  })

  // Select 59e30264-fb11-4e44-a91e-1c5cf80fd977
  await page
    .frameLocator("iframe")
    .locator(`label:text("1995")`)
    .selectOption({ label: "Finland switches their currency to Euro" })

  await page
    .frameLocator("iframe")
    .locator(`label:text("2002")`)
    .selectOption({ label: "Finland switches their currency to Euro" })

  await page
    .frameLocator("iframe")
    .locator(`label:text("1998")`)
    .selectOption({ label: "Finland joins the Economic and Monetary Union of the European Union" })

  await page.waitForTimeout(100)
  await page.locator(`button:disabled:text("Submit")`).waitFor()

  await page
    .frameLocator("iframe")
    .locator(`[aria-label="Remove"]:right-of(:text("2002"))`)
    .nth(0)
    .click()

  await page
    .frameLocator("iframe")
    .locator(`label:text("2002")`)
    .selectOption({ label: "Finland joins the European Union" })

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "timeline-filled",
    scrollToYCoordinate: 470,
  })

  await page.click("text=Submit")

  await page.frameLocator("iframe").locator("text=Your answer was partially correct.").waitFor()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "timeline-feedback-wrong",
    scrollToYCoordinate: 470,
  })

  await page.click("text=Try again")
  // Clear previous answers
  await page.frameLocator("iframe").locator(`[aria-label="Remove"]`).first().click()
  await page.frameLocator("iframe").locator(`[aria-label="Remove"]`).first().click()
  await page.frameLocator("iframe").locator(`[aria-label="Remove"]`).first().click()

  await page
    .frameLocator("iframe")
    .locator(`label:text("1995")`)
    .selectOption({ label: "Finland joins the European Union" })

  await page
    .frameLocator("iframe")
    .locator(`label:text("1998")`)
    .selectOption({ label: "Finland joins the Economic and Monetary Union of the European Union" })

  await page
    .frameLocator("iframe")
    .locator(`label:text("2002")`)
    .selectOption({ label: "Finland switches their currency to Euro" })

  await page.click("text=Submit")

  await page.frameLocator("iframe").locator("text=Your answer was correct.").waitFor()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "timeline-feedback-correct",
    scrollToYCoordinate: 470,
  })

  // Model solution is now visible since we got full points, so we can see what feedback looks like with the model solution

  await page.click("text=Try again")
  // Clear previous answers
  await page.frameLocator("iframe").locator(`[aria-label="Remove"]`).first().click()
  await page.frameLocator("iframe").locator(`[aria-label="Remove"]`).first().click()
  await page.frameLocator("iframe").locator(`[aria-label="Remove"]`).first().click()

  await page
    .frameLocator("iframe")
    .locator(`label:text("1998")`)
    .selectOption({ label: "Finland joins the European Union" })

  await page
    .frameLocator("iframe")
    .locator(`label:text("1995")`)
    .selectOption({ label: "Finland joins the Economic and Monetary Union of the European Union" })

  await page
    .frameLocator("iframe")
    .locator(`label:text("2002")`)
    .selectOption({ label: "Finland switches their currency to Euro" })

  await page.click("text=Submit")

  await page.frameLocator("iframe").locator("text=Your answer was partially correct.").waitFor()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "timeline-feedback-incorrect-with-model-solution",
    scrollToYCoordinate: 600,
  })
})
