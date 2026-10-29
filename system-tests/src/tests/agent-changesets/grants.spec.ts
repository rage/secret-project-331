import { expect, test } from "@playwright/test"

import { AGENT_CLIENT_NAME, AGENT_GRANT_HOLDER_EMAIL } from "@/utils/agentChangesets"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { openAuthorizedApplications } from "@/utils/oauth/authorizedClients"

test.use({ storageState: `src/states/${AGENT_GRANT_HOLDER_EMAIL}.json` })
// Revoking uses up the seeded grant, so a retry would fail for a different reason.
test.describe.configure({ retries: 0 })

test("teacher revokes an AI agent's access", async ({ page }) => {
  const permissions = await openAuthorizedApplications(page)

  const grant = await permissions.getAuthorizedApplication(AGENT_CLIENT_NAME)
  expect(grant.scopes).toBe("material:read, material:stage, material:publish")
  await expect(grant.row).toContainText("AI agent")
  await expect(grant.row).toContainText("not used yet")
  await expect(grant.revokeButton).toHaveAccessibleName(`Revoke access from ${AGENT_CLIENT_NAME}`)

  await grant.revokeButton.click()
  await expect(page.getByRole("dialog")).toContainText(`Remove access from ${AGENT_CLIENT_NAME}?`)
  await waitForSuccessNotification(
    page,
    async () => {
      await page.getByTestId("oauth-grant-revoke-confirm-button").click()
    },
    "Successfully deleted",
  )

  await expect(grant.row).toHaveCount(0)
})
