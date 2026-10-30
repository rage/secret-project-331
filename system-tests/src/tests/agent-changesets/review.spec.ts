import { expect, test } from "@playwright/test"

import {
  AGENT_CLIENT_NAME,
  AGENT_CONFLICTED_EMAIL,
  AGENT_PUBLISHER_EMAIL,
  AGENT_REVIEW_SETTINGS_EMAIL,
  agentChangesetsCourseUrl,
  agentEntityChange,
  openSeededAgentChangeset,
} from "@/utils/agentChangesets"
import { coursePageActionsMenu } from "@/utils/manageCoursePages"

// Publishing uses up the seeded changeset, so a retry would fail at a later step
// and hide the real failure.
test.describe("publishing", () => {
  test.use({ storageState: `src/states/${AGENT_PUBLISHER_EMAIL}.json` })
  test.describe.configure({ retries: 0 })

  test("teacher reviews and publishes changes that affect students", async ({ page }) => {
    await test.step("The course shows the AI agent changes tab", async () => {
      await page.goto(agentChangesetsCourseUrl())
      await expect(page.getByRole("tab", { name: /AI agent changes/ })).toBeVisible()
    })

    await openSeededAgentChangeset(page)

    const routineChange = agentEntityChange(page, "Page: Variables")
    const riskyChange = agentEntityChange(page, "Page: Old notes")

    await test.step("The routine edit renders before and after", async () => {
      await routineChange.getByRole("tab", { name: "Before" }).click()
      await expect(routineChange.getByTestId("agent-page-before")).toContainText(
        "A variable stores a value under a name.",
      )
      await routineChange.getByRole("tab", { name: "After" }).click()
      await expect(routineChange.getByTestId("agent-page-after")).toContainText(
        "For example, age = 30 stores the number 30 under the name age.",
      )
      await expect(routineChange.getByTestId("agent-risk-reasons")).toHaveCount(0)
    })

    await test.step("Before and after don't share element ids and sit below their headings", async () => {
      const duplicateIds = await page.getByTestId("agent-changeset-review").evaluate((review) => {
        const ids = [...review.querySelectorAll("[id]")].map((element) => element.id)
        return ids.filter((id, index) => ids.indexOf(id) !== index)
      })
      expect(duplicateIds).toStrictEqual([])
      const contentHeadings = routineChange
        .getByTestId("agent-page-after")
        .locator("h1, h2, h3, h4, h5, h6")
        .filter({ hasNotText: "After" })
      await expect(contentHeadings.first()).toBeVisible()
      for (const level of await contentHeadings.evaluateAll((headings) =>
        headings.map((heading) => Number(heading.getAttribute("aria-level"))),
      )) {
        expect(level).toBeGreaterThan(4)
      }
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

    await test.step("A failed publish says so in the dialog", async () => {
      await page.route(
        "**/api/v0/main-frontend/agent-changesets/*/publish",
        (route) =>
          route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              type: "bad_request",
              message_key: "bad_request",
              message: "The changeset is no longer open.",
            }),
          }),
        { times: 1 },
      )
      await page.getByTestId("agent-publish-button").click()
      await page.getByTestId("agent-publish-confirm-button").click()
      const dialog = page.getByRole("dialog")
      await expect(dialog.getByTestId("agent-publish-error")).toContainText(
        "The changes were not published.",
      )
      await dialog.getByRole("button", { name: "Cancel" }).click()
      await expect(page.getByTestId("agent-publish-outcome")).toHaveCount(0)
    })

    await test.step("Changes that changed after the page opened are not published", async () => {
      // Stands in for an agent call staged after the page loaded.
      await page.route(
        "**/api/v0/main-frontend/agent-changesets/*/publish",
        (route) => route.continue({ postData: JSON.stringify({ reviewed_revision: -1 }) }),
        { times: 1 },
      )
      await page.getByTestId("agent-publish-button").click()
      await page.getByTestId("agent-publish-confirm-button").click()
      await expect(page.getByTestId("agent-publish-outcome")).toContainText(
        "The agent changed these changes after you opened this page.",
      )
      await expect(page.getByText("Not published", { exact: true })).toBeVisible()
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
      // Not `chooseItem`: the item navigates away, so the trigger never reports itself closed.
      await coursePageActionsMenu(page, "Variables").getTrigger().click()
      await page.getByRole("menuitem", { name: "History", exact: true }).click()
      await expect(page.getByText(`via ${AGENT_CLIENT_NAME}`).first()).toBeVisible()
    })
  })
})

test.describe("conflicts", () => {
  test.use({ storageState: `src/states/${AGENT_CONFLICTED_EMAIL}.json` })

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

  test("exercise name and instruction edits are shown", async ({ page }) => {
    await openSeededAgentChangeset(page)
    const exerciseChange = agentEntityChange(page, "Page: Classes")

    await test.step("The name change is a before and after row", async () => {
      const nameRow = exerciseChange.getByRole("row", { name: /Exercise name/ })
      await expect(nameRow).toContainText("Classes quiz")
      await expect(nameRow).toContainText("Classes quiz: keywords")
    })

    await test.step("The instructions are rendered before and after", async () => {
      const instructions = exerciseChange.getByTestId("agent-blocks-change")
      await expect(instructions).toHaveCount(1)
      await expect(instructions.getByRole("heading", { name: /Task instructions/ })).toContainText(
        "Classes quiz: keywords",
      )
      await instructions.getByRole("tab", { name: "Before" }).click()
      await expect(instructions.getByTestId("agent-blocks-before")).toContainText(
        "Which keyword defines a class in Python?",
      )
      await instructions.getByRole("tab", { name: "After" }).click()
      await expect(instructions.getByTestId("agent-blocks-after")).toContainText(
        "Which Python keyword starts the definition of a class?",
      )
    })

    await test.step("Nothing warns about reviews", async () => {
      await expect(exerciseChange.getByTestId("agent-exercise-warnings")).toHaveCount(0)
    })
  })
})

test.describe("review settings", () => {
  test.use({ storageState: `src/states/${AGENT_REVIEW_SETTINGS_EMAIL}.json` })
  test.describe.configure({ retries: 0 })

  test("teacher reviews and publishes review instruction changes", async ({ page }) => {
    await openSeededAgentChangeset(page)
    const courseDefaultChange = agentEntityChange(page, "Default peer review instructions")
    const exerciseChange = agentEntityChange(page, "Page: Objects")

    await test.step("The course default change says how many exercises it reaches", async () => {
      await expect(courseDefaultChange.getByTestId("agent-default-review-config-reach")).toHaveText(
        "This change affects 2 exercises that use the course default review instructions.",
      )
      const instructions = courseDefaultChange.getByTestId("agent-blocks-change")
      await instructions.getByRole("tab", { name: "Before" }).click()
      await expect(instructions.getByTestId("agent-blocks-before")).toContainText(
        "Read the whole answer before you rate it.",
      )
      await instructions.getByRole("tab", { name: "After" }).click()
      await expect(instructions.getByTestId("agent-blocks-after")).toContainText(
        "say what was done well.",
      )
    })

    await test.step("Giving an exercise its own settings warns about its reviews", async () => {
      const warnings = exerciseChange.getByTestId("agent-exercise-warnings")
      await expect(warnings.getByRole("listitem")).toHaveText([
        "Methods essay will use its own review settings. Its 1 existing review will no longer be shown to students and will not match the review questions used for grading.",
      ])
      await expect(exerciseChange.getByTestId("agent-blocks-after")).toContainText(
        "Check that the answer calls a method on an object.",
      )
    })

    await test.step("Publish", async () => {
      await page.getByTestId("agent-publish-button").click()
      await page.getByTestId("agent-publish-confirm-button").click()
      await expect(page.getByTestId("agent-publish-outcome")).toContainText(
        "The changes are published",
      )
    })
  })
})
