import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice-dropdown screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=University of Helsinki, Department of Computer Science

  // Click text=Quizzes example, multiple-choice
  await page.selectOption("select", { label: "Quizzes example, multiple-choice dropdown" })

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-dropdown",
    waitForThisToBeVisibleAndStable: `text="How many different CSS hexadecimal color codes there are?"`,
    frame,
  })

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await frame.selectOption(
    `select:right-of(:text("How many different CSS hexadecimal color codes there are?"))`,
    { label: "at least two" },
  )

  await frame.selectOption(
    `select:right-of(:text("What other ways there are to represent colors in CSS?"))`,
    { label: "RGB -color system" },
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-dropdown-answered",
    waitForThisToBeVisibleAndStable: [
      `text="How many different CSS hexadecimal color codes there are?"`,
      `text="How many different CSS hexadecimal color codes there are?"`,
      `text="What other ways there are to represent colors in CSS?"`,
    ],
    frame,
  })
})
