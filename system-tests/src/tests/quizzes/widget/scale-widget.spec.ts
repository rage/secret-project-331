import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, scale", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Click text=Quizzes example, scale
  await page.selectOption("select", { label: "Quizzes example, scale" })

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-scale-initial",
    waitForThisToBeVisibleAndStable: [`text="Regex is generally readable."`, `text="15"`],
    frame,
  })

  if (!frame) {
    throw new Error("Could not find frame")
  }

  // Click input[type="radio"]
  await frame.click('input[type="radio"]')

  // Click text=1234567 >> input[type="radio"]
  await frame.click('text=1234567 >> input[type="radio"]')

  // Click text=123456789101112131415 >> input[type="radio"]
  await frame.click('text=123456789101112131415 >> input[type="radio"]')

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-scale-leftmost",
    waitForThisToBeVisibleAndStable: [`text="Regex is generally readable."`, `text="15"`],
    frame,
  })

  // NB! These only seem to work when the input value is greater than of the previous max option.
  // No idea how to fix.

  // Change second item to 4
  await frame.click("div:nth-child(2) div:nth-child(5) input")

  // Change third item to 15
  await frame.click("div:nth-child(3) div:nth-child(15) input")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-scale-mixed",
    waitForThisToBeVisibleAndStable: [`text="Regex is generally readable."`, `text="15"`],
    frame,
  })
})
