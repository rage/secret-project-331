import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, essay", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, essay" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await frame
    .locator(`textarea:below(:text("Min words"))`)
    .fill("I think I enrolled in the wrong course XD")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-essay-answered",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="Of the lamps of Fëanor"`)],
    screenshotTarget: frame,
  })

  await frame.locator(`textarea:below(:text("Min words"))`).fill(
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Laoreet sit amet cursus sit amet dictum sit. Et tortor consequat id porta nibh. Nibh sit amet commodo nulla facilisi nullam vehicula ipsum.

  Elit at imperdiet dui accumsan. Sit amet nisl suscipit adipiscing bibendum est ultricies. Mauris rhoncus aenean vel elit. Consequat ac felis donec et odio. Tortor pretium viverra suspendisse potenti nullam ac. Aenean pharetra magna ac placerat vestibulum. `,
  )

  page.locator(`text=Word count`)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-essay-long-answer",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Of the lamps of Fëanor"`),
      page.locator(`text=Word count: 79`),
    ],
    screenshotTarget: frame,
  })
})
