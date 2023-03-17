/* eslint-disable playwright/no-wait-for-timeout */
import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../../utils/expect"
import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorsParentIframeToViewIfNeeded,
} from "../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("history test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    await page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-history' }*/),
    page.locator("text=Introduction to history").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-history/chapter-1' }*/),
    page.click('a:has-text("The Basics")'),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-history/chapter-1/page-1' }*/),
    page.locator("text=1Page One").click(),
  ])
  await page.waitForLoadState("networkidle")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "initial-page",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Best exercise"`),
      page.locator(`text="Answer this question."`),
    ],
  })

  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course 'Introduction to history'\"] svg").click(),
  ])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  await Promise.all([page.waitForNavigation(), page.locator("text=Pages").click()])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad' }*/),
    page.click(`button:text("Edit page"):right-of(:text("Page One"))`),
  ])

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "New title!")

  await page.click(`button:text-is("Save") >> visible=true`)
  // TODO: wait for page saved notification
  await page.waitForSelector(`button:enabled:text("Save") >> visible=true`)
  await page.waitForTimeout(100)

  // Triple click [placeholder="Exercise name"]
  await page.click('[placeholder="Exercise name"]', {
    clickCount: 3,
  })

  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "New exercise!")

  await page.click(`button:text-is("Save") >> visible=true`)
  // TODO: wait for page saved notification
  await page.waitForSelector(`button:enabled:text("Save") >> visible=true`)
  await page.waitForTimeout(100)

  await page.click('[aria-label="Block: ExerciseTask"] div[role="button"]')

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
  await scrollLocatorsParentIframeToViewIfNeeded(frame)

  await frame.getByPlaceholder("Option text").first().click()

  await frame.getByPlaceholder("Option text").first().press("Control+a")
  // Fill [placeholder="Option text"]
  await frame.getByPlaceholder("Option text").first().fill("Updated answer")
  // Check input[type="checkbox"]
  await frame.locator(':nth-match(input[type="checkbox"], 2)').check()

  await page.click(`button:text-is("Save") >> visible=true`)
  await page.waitForSelector(`button:enabled:text("Save") >> visible=true`)
  await page.waitForTimeout(100)

  await page.goto("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course 'Introduction to history'\"] svg").click(),
  ])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  await Promise.all([page.waitForNavigation(), page.locator("text=Pages").click()])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")

  await page.click(`[aria-label="Dropdown menu"]:right-of(:text("New title"))`)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad/history' }*/),
    page.click(`a:has-text("History")`),
  ])

  await page.waitForSelector("text=core/paragraph")

  // Go back and navigate to the page again to workaround a race condition related to monaco editor fonts. This way the font used by monaco editor is already cached
  await page.goBack()
  await page.waitForSelector("text=Course pages for Introduction to history")

  await page.click(`[aria-label="Dropdown menu"]:right-of(:text("New title"))`)

  await Promise.all([page.waitForNavigation(), page.click(`a:has-text("History")`)])

  /*
  const stableElement = await page.waitForSelector("text=core/paragraph")
  await expectScreenshotsToMatchSnapshots({
screenshotTarget: page,
    headless, testInfo,    axeSkip: [`landmark-unique`],
    snapshotName: "history-view-p1",
    waitForTheseToBeVisibleAndStable: stableElement,

    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })
*/

  await page.click('[aria-label="Go to page 4"]')
  await expectUrlPathWithRandomUuid(page, "/manage/pages/[id]/history?page=4")

  /*
  const stableElement2 = await page.waitForSelector("text=core/paragraph")

  await expectScreenshotsToMatchSnapshots({
screenshotTarget: page,
    axeSkip: [`landmark-unique`],
    headless, testInfo,    snapshotName: "history-view-p4-before-compare",
    waitForTheseToBeVisibleAndStable: [stableElement2, "text=Compare"],

    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })
*/

  await page.waitForTimeout(100)

  await page.locator("text=Compare").click()
  await page.waitForSelector("text=core/paragraph")

  await page.click(':nth-match(:text("["), 3)')

  await page.press(
    ':nth-match([aria-label="Editor content;Press Alt+F1 for Accessibility Options."], 2)',
    "PageDown",
  )

  await page.press(
    ':nth-match([aria-label="Editor content;Press Alt+F1 for Accessibility Options."], 2)',
    "PageDown",
  )

  await page.waitForSelector("text=Best exercise")

  /*
  await expectScreenshotsToMatchSnapshots({
screenshotTarget: page,
    headless, testInfo,    axeSkip: [`landmark-unique`],
    snapshotName: "history-view-p4-after-compare",
    // wait for the diff to show up
    waitForTheseToBeVisibleAndStable: [
      ".line-delete",
      ".line-insert",
      ".insert-sign",
      ".delete-sign",
    ],
    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })
*/

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad/history?page=1' }*/),
    page.locator("text=Restore").click(),
  ])
  await page.locator("text=Page edit history").click() // deselect restore
  await page.waitForSelector("[aria-label='Current page: 1']")
  await page.waitForTimeout(100)
  /*
  await expectScreenshotsToMatchSnapshots({
screenshotTarget: page,
    headless, testInfo,    axeSkip: [`landmark-unique`],
    snapshotName: "history-view-after-restore",
    waitForTheseToBeVisibleAndStable: [page.locator("text=core/paragraph")],

    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })
*/
  await page.goto("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history' }*/),
    page.locator("text=Introduction to history").click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history/chapter-1' }*/),
    page.click('a:has-text("CHAPTER 1The Basics")'),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history/chapter-1/page-1' }*/),
    page.locator("text=1Page One").click(),
  ])

  await page.waitForLoadState("networkidle")
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "page-after-restore",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Best exercise"`),
      page.locator(`text="Answer this question."`),
    ],
  })
})

/*
async function replaceIdsAndTimesFromHistoryView(page: Page) {
  await page.evaluate(() => {
    const uuidRegex = new RegExp(
      "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}",
    )
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && uuidRegex.test(div.textContent)) {
        div.innerHTML = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (day month year)"
      } else if (div.children.length === 0 && div.textContent.includes("Edited by")) {
        div.innerHTML =
          "Edited by xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx on day month year hh:mm:ss timezone"
      } else if (div.children.length === 0 && div.textContent.includes("Restored from")) {
        div.innerHTML =
          "Restored from xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx by xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx on day month year hh:mm:ss timezone"
      }
    }
  })
  // application is listening for this event and puts placeholders for uuids
  await page.dispatchEvent("body", "testing-mode-replace-content-for-screenshot")
  await page.waitForTimeout(100)
}
*/
