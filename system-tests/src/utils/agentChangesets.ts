import type { Locator, Page } from "@playwright/test"
import { test } from "@playwright/test"

/** The live course `seed_agent_changesets.rs` seeds with AI agent changesets. */
const AGENT_CHANGESETS_COURSE_ID = "5b0e2a5c-4a26-4c55-9a0c-6f0f8c4f6a31"

export const AGENT_CLIENT_ID = "https://agent.example.com/oauth/client-metadata.json"
export const AGENT_CLIENT_NAME = "Example Agent"

/**
 * Existing seed users that `seed_agent_changesets.rs` gives agent changesets or grants. Each test
 * mutates only its own user's changeset or grant, so the specs can run in parallel.
 */
export const AGENT_PUBLISHER_EMAIL = "admin@example.com"
export const AGENT_CONFLICTED_EMAIL = "teacher@example.com"
export const AGENT_REVIEW_SETTINGS_EMAIL = "language.teacher@example.com"
export const AGENT_GRANT_HOLDER_EMAIL = "creator@example.com"
/** Has no seeded grant, so approving the consent screen touches no other test's grant. */
export const AGENT_CONSENT_EMAIL = "teaching-and-learning-services@example.com"

export const agentChangesetsCourseUrl = (path = "") =>
  `http://project-331.local/manage/courses/${AGENT_CHANGESETS_COURSE_ID}${path}`

/** A staged entity on the review page, by its heading such as "Page: Variables". */
export const agentEntityChange = (page: Page, heading: string): Locator =>
  page
    .getByTestId("agent-entity-change")
    .filter({ has: page.getByRole("heading", { name: heading }) })

/** Opens the signed-in user's only changeset in the seeded course on the review page. */
export async function openSeededAgentChangeset(page: Page): Promise<void> {
  await test.step("Open the AI agent changeset", async () => {
    await page.goto(agentChangesetsCourseUrl("/agent-changesets"))
    await page.getByTestId("agent-changeset-link").first().click()
    await page.getByTestId("agent-changeset-review").waitFor()
  })
}
