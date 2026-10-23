import type { Page } from "@playwright/test"
import { test } from "@playwright/test"

/** The live course `seed_agent_changesets.rs` seeds with AI agent changesets. */
export const AGENT_CHANGESETS_COURSE_ID = "5b0e2a5c-4a26-4c55-9a0c-6f0f8c4f6a31"

export const AGENT_CLIENT_ID = "https://agent.example.com/oauth/client-metadata.json"
export const AGENT_CLIENT_NAME = "Example Agent"

/** Each test mutates only its own user's changeset or grant, so the specs can run in parallel. */
export const AGENT_PUBLISHER_EMAIL = "agent-publisher@example.com"
export const AGENT_DISCARDER_EMAIL = "agent-discarder@example.com"
export const AGENT_CONFLICTED_EMAIL = "agent-conflicted@example.com"
export const AGENT_GRANT_HOLDER_EMAIL = "agent-grant-holder@example.com"

export const AGENT_CHANGESET_USER_EMAILS = [
  AGENT_PUBLISHER_EMAIL,
  AGENT_DISCARDER_EMAIL,
  AGENT_CONFLICTED_EMAIL,
  AGENT_GRANT_HOLDER_EMAIL,
]

export const agentStorageState = (email: string) => `src/states/${email}.json`

export const agentChangesetsCourseUrl = (path = "") =>
  `http://project-331.local/manage/courses/${AGENT_CHANGESETS_COURSE_ID}${path}`

/** Opens the signed-in user's only changeset in the seeded course on the review page. */
export async function openSeededAgentChangeset(page: Page): Promise<void> {
  await test.step("Open the AI agent changeset", async () => {
    await page.goto(agentChangesetsCourseUrl("/agent-changesets"))
    await page.getByTestId("agent-changeset-link").first().click()
    await page.getByTestId("agent-changeset-review").waitFor()
  })
}
