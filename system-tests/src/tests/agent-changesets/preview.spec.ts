import { expect, test } from "@playwright/test"

import {
  AGENT_CONFLICTED_EMAIL,
  agentStorageState,
  openSeededAgentChangeset,
} from "@/utils/agentChangesets"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({ storageState: agentStorageState(AGENT_CONFLICTED_EMAIL) })

test("preview renders a staged page without logging in", async ({
  page,
  browser,
  headless,
}, testInfo) => {
  await openSeededAgentChangeset(page)

  const functionsChange = page
    .getByTestId("agent-entity-change")
    .filter({ has: page.getByRole("heading", { name: "Page: Functions" }) })
  await functionsChange.getByTestId("agent-open-preview-button").click()
  await page.waitForURL(/\/agent-preview\//)
  const previewUrl = page.url()

  const loggedOutContext = await browser.newContext()
  try {
    const previewPage = await loggedOutContext.newPage()
    await previewPage.goto(previewUrl)

    await expect(previewPage.getByTestId("agent-preview-banner")).toContainText(
      "Preview of unpublished changes.",
    )
    const content = previewPage.getByTestId("agent-preview-content")
    await expect(content.getByRole("heading", { name: "Functions" })).toBeVisible()
    await expect(content).toContainText(
      "For example, def greet(): defines a function called greet.",
    )
    await expect(content.getByRole("heading", { name: "Functions quiz" })).toBeVisible()
    await expect(content.getByTestId("agent-preview-exercise-placeholder")).toBeVisible()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: previewPage,
      headless,
      testInfo,
      snapshotName: "agent-preview",
      waitForTheseToBeVisibleAndStable: [content.getByTestId("agent-preview-exercise-placeholder")],
    })
  } finally {
    await loggedOutContext.close()
  }
})
