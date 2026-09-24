import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Chart block renders for students", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.locator(`div:text-is("Introduction to Course Material")`).click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("User Experience").click()
  await page.getByText("Chart rendering").click()

  // The happy-path chart shows its caption.
  const caption = page.getByText(
    "Figure 1: a simple bar chart rendered from an external data file.",
  )
  await caption.waitFor()

  // Rendering the charts must not have crashed the blocks' error boundary.
  await expect(page.getByRole("alert").filter({ hasText: "crashed" })).toBeHidden()

  // A valid spec with no data and an unparseable spec fall back to messages instead of breaking.
  await expect(page.getByText("This chart is missing its data file.")).toBeVisible()
  await expect(
    page.getByText("The chart could not be displayed because its specification is invalid."),
  ).toBeVisible()

  // Vega gives its rendered chart's root SVG the "marks" class. The bars only exist once the chart's
  // data file has loaded, so waiting for all six means the chart is fully drawn — the caption is
  // there from the first render and says nothing about that.
  const chart = page.locator("svg.marks")
  await expect(chart.locator("g.mark-rect path")).toHaveCount(6)
  // The chart's text has to be the site font. Left to Vega's default it would be the browser's
  // sans-serif: the one thing on the page in a system font, so it would also rasterize differently
  // from machine to machine and the screenshots below could not be compared exactly.
  await expect(chart.locator("text").first()).toHaveAttribute("font-family", /Inter/)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "chart-block-render",
    waitForTheseToBeVisibleAndStable: [caption, chart],
    screenshotOptions: { fullPage: true },
  })
})
