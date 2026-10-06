import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

const ADMIN_STORAGE_STATE = "src/states/admin@example.com.json"

test.use({
  storageState: ADMIN_STORAGE_STATE,
})

const HEADINGS_PAGE =
  "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/content-rendering-headings"

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: ADMIN_STORAGE_STATE })
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.locator(`div:text-is("Introduction to Course Material")`).click()
  await selectCourseInstanceIfPrompted(page)
  await page.close()
})

test("heading renders its anchor and reveals the copy link on hover", async ({ page }) => {
  await page.goto(HEADINGS_PAGE)

  const heading = page.locator("h2#heading-2")
  const copyLink = heading.getByRole("link")
  await expect(copyLink).toHaveAttribute("href", "#heading-2")

  // Only offered once the reader shows interest in the heading, so it cannot be asserted in jsdom.
  await expect(copyLink).toHaveCSS("opacity", "0")
  await heading.hover()
  await expect(copyLink).toHaveCSS("opacity", "1")
})

test("derives a readable anchor for a heading that has none set", async ({ page }) => {
  await page.goto(HEADINGS_PAGE)

  // The leading fragment comes from the block's client id, the rest from the heading's text.
  const heading = page.locator("h2#a1b2c3d4-heading-without-an-anchor")
  await expect(heading).toHaveText(/Heading without an anchor/)
  await expect(heading.getByRole("link")).toHaveAttribute(
    "href",
    "#a1b2c3d4-heading-without-an-anchor",
  )
})

test("copy link is reachable with the keyboard", async ({ page }) => {
  await page.goto(HEADINGS_PAGE)

  const copyLink = page.locator("h2#heading-2").getByRole("link")
  await copyLink.focus()

  await expect(copyLink).toBeFocused()
  await expect(copyLink).toHaveCSS("opacity", "1")
})
