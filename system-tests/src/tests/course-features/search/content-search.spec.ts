import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "@/utils/expect"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("content search", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  await page.click(`div:text-is("Introduction to Course Material")`)

  await selectCourseInstanceIfPrompted(page)

  await page.click('a:has-text("CHAPTER 2User Experience")')

  await page.getByText("User research").first().click()

  await page.click('[aria-label="Search for pages"]')

  await page.click('[placeholder="Search..."]')

  // Fill [placeholder="Search..."]
  await page.fill('[placeholder="Search..."]', "ma")
  await page.getByText("Human-machine interface").waitFor()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["aria-hidden-focus", "landmark-unique", "landmark-one-main", "page-has-heading-one"],
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "search-content-with-short-prefix",
    waitForTheseToBeVisibleAndStable: [page.getByText("Human-machine interface")],
    screenshotOptions: { maxDiffPixelRatio: 0.05 },
  })

  await page.getByText("Human-machine interface").click()

  await expectUrlPathWithRandomUuid(
    page,
    "/org/uh-cs/courses/introduction-to-course-material/chapter-1/human-machine-interface",
  )

  await page.click('[aria-label="Search for pages"]')

  await page.click('[placeholder="Search..."]')

  // Fill [placeholder="Search..."]
  await page.fill('[placeholder="Search..."]', "welcome course")
  await page
    .getByText("Welcome to Introduction to Course Material In this course you'll...")
    .waitFor()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["aria-hidden-focus", "landmark-one-main", "page-has-heading-one"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "search-content-with-two-words-not-just-after-each-other",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Welcome to Introduction to Course Material"),
    ],
  })

  // phrases should be ranked higher than word matches
  // For example if the search word is banana cat the text banana cat should be
  // ranked higher than the text banana ...lots of random text... cat
  await page.fill('[placeholder="Search..."]', "banana cat")
  await page.getByText("banana cat enim").waitFor()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["landmark-one-main", "page-has-heading-one"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "search-continuous-phrases-ranked-higher-than-word-matches",
    waitForTheseToBeVisibleAndStable: [page.getByText("banana cat enim")],
  })
})
