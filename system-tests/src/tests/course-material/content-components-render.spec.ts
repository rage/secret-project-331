/* oxlint-disable playwright/prefer-locator */
import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { selectOrganization } from "@/utils/organizationUtils"

const ADMIN_STORAGE_STATE = "src/states/admin@example.com.json"

test.use({
  storageState: ADMIN_STORAGE_STATE,
})

const CONTENT_RENDERING_PAGES = [
  "paragraphs",
  "headings",
  "lists",
  "quotes",
  "images",
  "code",
  "pullquotes",
  "callouts",
  "tables",
  "verse",
  "buttons",
  "separators",
  "columns",
]

const COURSE_BASE_URL = "http://project-331.local/org/uh-cs/courses/introduction-to-course-material"

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: ADMIN_STORAGE_STATE })
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.click(`div:text-is("Introduction to Course Material")`)
  await selectCourseInstanceIfPrompted(page)
  await page.close()
})

for (const pageSlug of CONTENT_RENDERING_PAGES) {
  test(`${pageSlug} blocks render correctly`, async ({ page, headless }, testInfo) => {
    await page.goto(`${COURSE_BASE_URL}/chapter-2/content-rendering-${pageSlug}`)

    // Wait for attached rather than visible: some pages start with an invisible block (e.g.
    // core/spacer), and expectScreenshotsToMatchSnapshots already waits for loading spinners.
    await page.locator("#content [data-block-name]").first().waitFor({ state: "attached" })
    await expect(page.getByText("crashed")).toBeHidden()

    await expectScreenshotsToMatchSnapshots({
      // TODO: these should be removed
      axeSkip: ["color-contrast", "empty-table-header"],
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: `content-rendering-${pageSlug}`,
      waitForTheseToBeVisibleAndStable: undefined,
      clearNotifications: true,
      screenshotOptions: { fullPage: true, timeout: 10_000 },
    })
  })
}

test("cropped image with a focal point is cropped via object-fit and positioned by the focal point", async ({
  page,
}) => {
  await page.goto(`${COURSE_BASE_URL}/chapter-2/content-rendering-images`)

  const focalPointImage = page.locator(`#content img[alt="RAGE logo cropped with focal point"]`)
  await focalPointImage.waitFor({ state: "attached" })

  // The image declares width 600 / height 300 with scale "cover" and focalPoint { x: 0.5, y: 0.2 }.
  // object-fit comes from the `scale` attribute (not the old transform: scale misread) and
  // object-position comes from the focal point.
  await expect(focalPointImage).toHaveCSS("object-fit", "cover")
  await expect(focalPointImage).toHaveCSS("object-position", "50% 20%")
})
