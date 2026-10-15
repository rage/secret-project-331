import { expect, test } from "@playwright/test"

// Smoke test for the client-side page-title mechanism (see
// shared-module/.../components/PageTitle/PageTitleManager): a client-rendered page registers a
// localized per-page title via usePageTitle, which PageTitleManager applies to document.title.
test("PageTitleManager sets a localized per-page title on a client-rendered page", async ({
  page,
}) => {
  await page.goto("http://project-331.local/organizations")
  await expect(page).toHaveTitle(/Organizations/)
})
