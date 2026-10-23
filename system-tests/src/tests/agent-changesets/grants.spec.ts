import { expect, test } from "@playwright/test"

import {
  AGENT_CLIENT_NAME,
  AGENT_GRANT_HOLDER_EMAIL,
  agentStorageState,
} from "@/utils/agentChangesets"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({ storageState: agentStorageState(AGENT_GRANT_HOLDER_EMAIL) })

test("teacher revokes an AI agent's access", async ({ page }) => {
  await page.goto("http://project-331.local/user-settings/permissions")

  const section = page.getByTestId("authorized-applications-section")
  const grant = section.locator('[data-testid^="authorized-app-"]').filter({
    hasText: AGENT_CLIENT_NAME,
  })
  await expect(grant).toContainText("AI agent")
  await expect(grant).toContainText("material:read, material:stage, material:publish")
  await expect(grant).toContainText("not used yet")

  await grant.getByRole("button", { name: "Revoke" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText(`Remove access from ${AGENT_CLIENT_NAME}?`)
  await waitForSuccessNotification(page, async () => {
    await page.getByTestId("oauth-grant-revoke-confirm-button").click()
  })

  await expect(grant).toHaveCount(0)
  await expect(section).toContainText("No authorized applications")
})
