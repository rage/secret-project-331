import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, essay", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, essay" })

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-essay",
    waitForThisToBeVisibleAndStable: [`text="Of the lamps of Fëanor"`],
    frame,
  })

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await frame.fill(
    `textarea:below(:text("Min words"))`,
    "I think I enrolled in the wrong course XD",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-essay-answered",
    waitForThisToBeVisibleAndStable: [`text="Of the lamps of Fëanor"`],
    frame,
  })

  await frame.fill(
    `textarea:below(:text("Min words"))`,
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Laoreet sit amet cursus sit amet dictum sit. Et tortor consequat id porta nibh. Nibh sit amet commodo nulla facilisi nullam vehicula ipsum.

  Elit at imperdiet dui accumsan. Sit amet nisl suscipit adipiscing bibendum est ultricies. Mauris rhoncus aenean vel elit. Consequat ac felis donec et odio. Tortor pretium viverra suspendisse potenti nullam ac. Aenean pharetra magna ac placerat vestibulum. `,
  )

  page.locator(`text=Word count`)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-essay-long-answer",
    waitForThisToBeVisibleAndStable: [`text="Of the lamps of Fëanor"`, `text=Word count: 79`],
    frame,
  })
})
