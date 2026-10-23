import { expect, test } from "@playwright/test"

import {
  AGENT_CLIENT_NAME,
  AGENT_CONFLICTED_EMAIL,
  AGENT_DISCARDER_EMAIL,
  AGENT_PUBLISHER_EMAIL,
  agentChangesetsCourseUrl,
  agentStorageState,
  openSeededAgentChangeset,
} from "@/utils/agentChangesets"
import { coursePageActionsMenu } from "@/utils/manageCoursePages"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.describe("publishing", () => {
  test.use({ storageState: agentStorageState(AGENT_PUBLISHER_EMAIL) })

  test("teacher reviews and publishes changes that affect students", async ({ page }) => {
    await test.step("The course shows the AI agent changes tab", async () => {
      await page.goto(agentChangesetsCourseUrl())
      await expect(page.getByRole("tab", { name: /AI agent changes/ })).toBeVisible()
    })

    await openSeededAgentChangeset(page)

    const routineChange = page
      .getByTestId("agent-entity-change")
      .filter({ has: page.getByRole("heading", { name: "Page: Variables" }) })
    const riskyChange = page
      .getByTestId("agent-entity-change")
      .filter({ has: page.getByRole("heading", { name: "Page: Old notes" }) })

    await test.step("The routine edit renders before and after", async () => {
      await expect(routineChange.getByTestId("agent-page-before")).toContainText(
        "A variable stores a value under a name.",
      )
      await expect(routineChange.getByTestId("agent-page-after")).toContainText(
        "For example, age = 30 stores the number 30 under the name age.",
      )
      await expect(routineChange.getByTestId("agent-risk-reasons")).toHaveCount(0)
    })

    await test.step("The risky change says what happens to students", async () => {
      await expect(page.getByText("1 change affects students")).toBeVisible()
      await expect(riskyChange.getByText("Affects students")).toBeVisible()
      await expect(riskyChange.getByTestId("agent-risk-reasons")).toContainText(
        "Removes a page that students can see.",
      )
      await expect(riskyChange.getByTestId("agent-risk-reasons")).toContainText(
        "What happens: The page disappears for students.",
      )
    })

    await test.step("The calls list what the agent did", async () => {
      await page.getByTestId("agent-calls-disclosure").click()
      await expect(page.getByTestId("agent-calls")).toContainText("Remove the outdated notes page")
      await expect(page.getByTestId("agent-calls")).toContainText(AGENT_CLIENT_NAME)
    })

    await test.step("Publish after confirming", async () => {
      await page.getByTestId("agent-publish-button").click()
      await expect(page.getByText("1 of them affects students.")).toBeVisible()
      await page.getByTestId("agent-publish-confirm-button").click()
      await expect(page.getByTestId("agent-publish-outcome")).toContainText(
        "The changes are published",
      )
      await expect(page.getByText("Published", { exact: true })).toBeVisible()
      await expect(page.getByTestId("agent-publish-button")).toHaveCount(0)
    })

    await test.step("Page history names the agent", async () => {
      await page.goto(agentChangesetsCourseUrl("/pages"))
      await coursePageActionsMenu(page, "Variables").chooseItem("History")
      await expect(page.getByText(`via ${AGENT_CLIENT_NAME}`).first()).toBeVisible()
    })
  })
})

test.describe("discarding", () => {
  test.use({ storageState: agentStorageState(AGENT_DISCARDER_EMAIL) })

  test("teacher discards the agent's changes", async ({ page }) => {
    await openSeededAgentChangeset(page)
    await expect(page.getByRole("heading", { name: "Page: Loops" })).toBeVisible()

    await waitForSuccessNotification(page, async () => {
      await page.getByTestId("agent-discard-button").click()
      await page.getByTestId("agent-discard-confirm-button").click()
    })

    await expect(page.getByText("Discarded", { exact: true })).toBeVisible()
    await expect(page.getByTestId("agent-discard-button")).toHaveCount(0)
  })
})

test.describe("conflicts", () => {
  test.use({ storageState: agentStorageState(AGENT_CONFLICTED_EMAIL) })

  test("changes made after the agent block publishing", async ({ page }) => {
    await openSeededAgentChangeset(page)

    await expect(page.getByTestId("agent-conflicts")).toContainText("Strings and text")
    const conflictedChange = page
      .getByTestId("agent-entity-change")
      .filter({ hasText: "Changed by someone else" })
    await expect(conflictedChange).toHaveCount(1)
    await expect(conflictedChange.getByTestId("agent-page-after")).toContainText(
      "Strings can be joined with the + operator.",
    )
    await expect(page.getByTestId("agent-publish-button")).toBeDisabled()
  })
})
