import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Introduction to Course Material
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-course-material' }*/),
    page.click("text=Introduction to Course Material"),
  ])

  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  // Click a:has-text("CHAPTER 2User Experience")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-course-material/chapter-2' }*/),
    page.click('a:has-text("CHAPTER 2User Experience")'),
  ])

  // Click text=User research
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-course-material/chapter-2/user-research' }*/),
    page.click("text=User research"),
  ])

  // Click text=Search
  await page.click('[aria-label="Search for pages"]')

  // Click [placeholder="Search..."]
  await page.click('[placeholder="Search..."]')

  // Fill [placeholder="Search..."]
  await page.fill('[placeholder="Search..."]', "ma")
  await page.waitForSelector("text=Human-machine interface")

  await expectScreenshotsToMatchSnapshots({
    headless,
    page,
    snapshotName: "search-content-with-short-prefix",
    waitForThisToBeVisibleAndStable: "text=Human-machine interface",
  })

  // Click text=Human-machine interface
  await Promise.all([page.waitForNavigation(), await page.click("text=Human-machine interface")])

  expect(page.url()).toBe(
    "http://project-331.local/courses/introduction-to-course-material/chapter-1/human-machine-interface",
  )

  // Click text=Search
  await page.click('[aria-label="Search for pages"]')

  // Click [placeholder="Search..."]
  await page.click('[placeholder="Search..."]')

  // Fill [placeholder="Search..."]
  await page.fill('[placeholder="Search..."]', "welcome course")
  await page.waitForSelector("text=Introduction to Course Material")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "search-content-with-two-words-not-just-after-each-other",
    waitForThisToBeVisibleAndStable: "text=Introduction to Course Material",
  })

  // phrases should be ranked higher than word matches
  // For example if the search word is banana cat the text banana cat should be
  // ranked higher than the text banana ...lots of random text... cat
  await page.fill('[placeholder="Search..."]', "banana cat")
  await page.waitForSelector("text=banana cat enim")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "search-continuous-phrases-ranked-higher-than-word-matches",
    waitForThisToBeVisibleAndStable: "text=banana cat enim",
  })
})
