import { expect, test } from "@playwright/test"

import {
  AGENT_CONFLICTED_EMAIL,
  agentChangesetsCourseUrl,
  agentStorageState,
} from "@/utils/agentChangesets"
import { openCoursePageInEditor } from "@/utils/manageCoursePages"

test.use({ storageState: agentStorageState(AGENT_CONFLICTED_EMAIL) })

test("page editor tells about the teacher's unpublished agent changes", async ({ page }) => {
  await test.step("No notice on a page the agent did not change", async () => {
    await page.goto(agentChangesetsCourseUrl("/pages"))
    const pendingChanges = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" && response.url().endsWith("/pending-agent-changes"),
    )
    await openCoursePageInEditor(page, "Variables")
    expect(await (await pendingChanges).json()).toBeNull()
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible()
    await expect(page.getByTestId("pending-agent-changes-notice")).toHaveCount(0)
  })

  await test.step("Notice links to the review page", async () => {
    await page.goto(agentChangesetsCourseUrl("/pages"))
    await openCoursePageInEditor(page, "Functions")
    const notice = page.getByTestId("pending-agent-changes-notice")
    await expect(notice).toContainText("Your AI agent has changed this page.")
    await notice.getByRole("link", { name: "Review the changes" }).click()
    await page.getByTestId("agent-changeset-review").waitFor()
    await expect(page.getByRole("heading", { name: "Page: Functions" })).toBeVisible()
  })
})
