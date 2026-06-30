import { expect, test } from "@playwright/test"

// Infrastructure smoke test for the client-side page-title mechanism (see
// shared-module/.../components/PageTitle/PageTitleManager). No page sets a per-page title yet,
// so this asserts the manager's fallback path: document.title is the bare site name. Per-page
// title assertions are added when pages adopt usePageTitle.
test("PageTitleManager sets the default site title on a client-rendered page", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
  await expect(page).toHaveTitle(/Secret Project 331/)
})
