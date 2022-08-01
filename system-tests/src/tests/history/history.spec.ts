import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectPath from "../../utils/expect"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("history test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Introduction to history
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-history' }*/),
    page.click("text=Introduction to history"),
  ])

  await page.click('input[label="Default"]')
  // Click button:has-text("Continue")
  await selectCourseInstanceIfPrompted(page)

  // Click a:has-text("CHAPTER 1The Basics")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-history/chapter-1' }*/),
    page.click('a:has-text("The Basics")'),
  ])

  // Click text=1Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-history/chapter-1/page-1' }*/),
    page.click("text=1Page One"),
  ])
  await page.waitForLoadState("networkidle")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "initial-page",
    waitForThisToBeVisibleAndStable: [`text="Best exercise"`, `text="Answer this question."`],
  })

  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Manage
  await Promise.all([
    page.waitForNavigation(),
    page.click("[aria-label=\"Manage course 'Introduction to history'\"] svg"),
  ])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Pages")])
  expectPath(page, "/manage/courses/[id]/pages")

  // Click text=Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad' }*/),
    page.click(`button:text("Edit page"):right-of(:text("Page One"))`),
  ])

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "New title!")

  // Click button:text-is("Save")
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

  // Click button:text-is("Save")
  await page.click(`button:text-is("Save") >> visible=true`)
  // TODO: wait for page saved notification
  await page.waitForSelector(`button:enabled:text("Save") >> visible=true`)
  await page.waitForTimeout(100)

  // Click [aria-label="Block: ExerciseTask"] div[role="button"]
  await page.click('[aria-label="Block: ExerciseTask"] div[role="button"]')

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await (await frame.frameElement()).scrollIntoViewIfNeeded()

  // Click [placeholder="Option text"]
  await frame.click('[placeholder="Option text"]')
  // Press a with modifiers
  await frame.press('[placeholder="Option text"]', "Control+a")
  // Fill [placeholder="Option text"]
  await frame.fill('[placeholder="Option text"]', "Updated answer")
  // Check input[type="checkbox"]
  await frame.check(':nth-match(input[type="checkbox"], 2)')

  // Click button:text-is("Save")
  await page.click(`button:text-is("Save") >> visible=true`)
  await page.waitForSelector(`button:enabled:text("Save") >> visible=true`)
  await page.waitForTimeout(100)

  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click('[aria-label="Home page"]'),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Manage
  await Promise.all([
    page.waitForNavigation(),
    page.click("[aria-label=\"Manage course 'Introduction to history'\"] svg"),
  ])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Pages")])
  expectPath(page, "/manage/courses/[id]/pages")

  await page.click(`[aria-label="Dropdown menu"]:right-of(:text("New title"))`)

  // Click text=New title!(/chapter-1/page-1) history >> :nth-match(a, 2)
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
    page,
    headless,
    axeSkip: [`landmark-unique`],
    snapshotName: "history-view-p1",
    waitForThisToBeVisibleAndStable: stableElement,
    toMatchSnapshotOptions: { threshold: 0.3 },
    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })
*/
  // Click [aria-label="Go to page 4"]
  await page.click('[aria-label="Go to page 4"]')
  expectPath(page, "/manage/pages/[id]/history?page=4")

  /*
  const stableElement2 = await page.waitForSelector("text=core/paragraph")

  await expectScreenshotsToMatchSnapshots({
    page,
    axeSkip: [`landmark-unique`],
    headless,
    snapshotName: "history-view-p4-before-compare",
    waitForThisToBeVisibleAndStable: [stableElement2, "text=Compare"],
    toMatchSnapshotOptions: { threshold: 0.3 },
    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })
*/

  await page.waitForTimeout(100)

  // Click text=Compare
  await page.click("text=Compare")
  await page.waitForSelector("text=core/paragraph")

  // Click :nth-match(:text("["), 3)
  await page.click(':nth-match(:text("["), 3)')
  // Press PageDown
  await page.press(
    ':nth-match([aria-label="Editor content;Press Alt+F1 for Accessibility Options."], 2)',
    "PageDown",
  )
  // Press PageDown
  await page.press(
    ':nth-match([aria-label="Editor content;Press Alt+F1 for Accessibility Options."], 2)',
    "PageDown",
  )

  await page.waitForSelector("text=Best exercise")

  /*
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    axeSkip: [`landmark-unique`],
    snapshotName: "history-view-p4-after-compare",
    // wait for the diff to show up
    waitForThisToBeVisibleAndStable: [
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

  // Click text=Restore
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad/history?page=1' }*/),
    page.click("text=Restore"),
  ])
  await page.click("text=Page edit history") // deselect restore
  await page.waitForSelector("[aria-label='page 1'][aria-current='true']")
  await page.waitForTimeout(100)
  /*
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    axeSkip: [`landmark-unique`],
    snapshotName: "history-view-after-restore",
    waitForThisToBeVisibleAndStable: "text=core/paragraph",
    toMatchSnapshotOptions: { threshold: 0.3 },
    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })
*/
  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click('[aria-label="Home page"]'),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await page.click("text=University of Helsinki, Department of Computer Science")
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Introduction to history
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history' }*/),
    page.click("text=Introduction to history"),
  ])

  // Click a:has-text("CHAPTER 1The Basics")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history/chapter-1' }*/),
    page.click('a:has-text("CHAPTER 1The Basics")'),
  ])

  // Click text=1Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history/chapter-1/page-1' }*/),
    page.click("text=1Page One"),
  ])

  await page.waitForLoadState("networkidle")
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "page-after-restore",
    waitForThisToBeVisibleAndStable: [`text="Best exercise"`, `text="Answer this question."`],
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
