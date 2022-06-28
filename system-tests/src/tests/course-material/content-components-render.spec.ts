import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("blocks render correctly", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [id="__next"] div >> :nth-match(div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer "), 4)
  await Promise.all([
    page.waitForNavigation(),
    page.click(
      '[id="__next"] div >> :nth-match(div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer "), 4)',
    ),
  ])
  // Click text=Introduction to Course Material
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-course-material' }*/),
    page.click(`div:text-is("Introduction to Course Material")`),
  ])
  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')
  // Click text=User Experience
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2' }*/),
    page.click("text=User Experience"),
  ])
  // Click text=Content rendering
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cscourses/introduction-to-course-material/chapter-2/content-rendering' }*/),
    page.click("text=Content rendering"),
  ])

  await page.waitForSelector("text=100px wide")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true,
    page,
    headless,
    snapshotName: "content-components-renderer-view",
    waitForThisToBeVisibleAndStable: null,
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })
})
