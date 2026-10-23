import { expect, test } from "@playwright/test"

import {
  AGENT_CONFLICTED_EMAIL,
  agentEntityChange,
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

  const functionsChange = agentEntityChange(page, "Page: Functions")
  await functionsChange.getByTestId("agent-open-preview-button").click()
  await page.waitForURL(/\/agent-preview\//)
  const previewUrl = page.url()

  const loggedOutContext = await browser.newContext()
  try {
    const previewPage = await loggedOutContext.newPage()
    const previewResponse = previewPage.waitForResponse(/\/api\/v0\/main-frontend\/agent-preview\//)
    await previewPage.goto(previewUrl)

    await test.step("The preview sends nothing students don't see", async () => {
      const body = await (await previewResponse).text()
      expect(body).toContain("Functions quiz")
      expect(body).not.toContain("private_spec")
      expect(body).not.toContain("model_solution")
    })

    await expect(previewPage.getByTestId("agent-preview-banner")).toContainText(
      "Preview of unpublished changes.",
    )
    const content = previewPage.getByTestId("agent-preview-content")
    await expect(content.getByRole("heading", { name: "Functions", exact: true })).toBeVisible()
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

    await test.step("Content shown only to some students is shown with a note", async () => {
      await previewPage.route("**/api/v0/main-frontend/agent-preview/**", async (route) => {
        const response = await route.fetch()
        const preview = await response.json()
        preview.page.content.push(
          {
            name: "moocfi/conditional-block",
            clientId: "a1b2c3d4-0000-4000-8000-000000000001",
            isValid: true,
            attributes: { module_completion: [], instance_enrollment: [] },
            innerBlocks: [
              {
                name: "core/paragraph",
                clientId: "a1b2c3d4-0000-4000-8000-000000000002",
                isValid: true,
                attributes: { content: "Shown after the module is completed.", dropCap: false },
                innerBlocks: [],
              },
            ],
          },
          {
            name: "moocfi/exercises-in-chapter",
            clientId: "a1b2c3d4-0000-4000-8000-000000000003",
            isValid: true,
            attributes: {},
            innerBlocks: [],
          },
        )
        await route.fulfill({ response, json: preview })
      })
      await previewPage.reload()
      const container = content.getByTestId("agent-preview-student-specific-container")
      await expect(container).toContainText("Only some students see the content below")
      await expect(container).toContainText("Shown after the module is completed.")
      await expect(
        content
          .getByTestId("agent-preview-block-placeholder")
          .filter({ hasText: "moocfi/exercises-in-chapter" }),
      ).toBeVisible()
    })
  } finally {
    await loggedOutContext.close()
  }
})
