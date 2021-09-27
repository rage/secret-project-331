import { expect, Page, test } from "@playwright/test"

import expectPath from "../../utils/expect"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Introduction to history
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history' }*/),
    page.click("text=Introduction to history"),
  ])

  // Click text=default
  await page.click("text=default")
  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  // Click a:has-text("CHAPTER 1The Basics")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history/chapter-1' }*/),
    page.click('a:has-text("The Basics")'),
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
    snapshotName: "initial-page",
    waitForThisToBeVisibleAndStable: null,
  })

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

  // Click text=Manage
  await Promise.all([
    page.waitForNavigation(),
    await page.click('a:right-of(:text("Introduction to history"))'),
  ])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Manage pages")])
  expectPath(page, "/manage/courses/[id]/pages")

  // Click text=Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad' }*/),
    page.click("text=Page One"),
  ])

  // Triple click input[type="text"]
  await page.click('input[type="text"]', {
    clickCount: 3,
  })

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "New title!")

  // Click text=Save
  await page.click("text=Save")

  // Triple click [placeholder="Exercise name"]
  await page.click('[placeholder="Exercise name"]', {
    clickCount: 3,
  })

  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "New exercise!")

  // get current exercise editor before a save...
  const currentEditor = await page.waitForSelector('iframe[src^="/example-exercise/editor"]')

  // Click text=Save
  await page.click("text=Save")

  // ...and wait for it to get detached after a save, as the new editor loads in
  await currentEditor.waitForElementState("hidden")

  const frame = await waitForFunction(page, () =>
    page
      .frames()
      .find((f) => f.url().startsWith("http://project-331.local/example-exercise/editor")),
  )

  // Click [placeholder="Option text"]
  await frame.click('[placeholder="Option text"]')
  // Press a with modifiers
  await frame.press('[placeholder="Option text"]', "Control+a")
  // Fill [placeholder="Option text"]
  await frame.fill('[placeholder="Option text"]', "Updated answer")
  // Check input[type="checkbox"]
  await frame.check(':nth-match(input[type="checkbox"], 2)')

  // Click text=Save
  await page.click("text=Save")
  await page.waitForTimeout(100)

  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click('[aria-label="Front page"]'),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Manage
  await Promise.all([
    page.waitForNavigation(),
    await page.click('a:right-of(:text("Introduction to history"))'),
  ])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), await page.click("text=Manage pages")])
  expectPath(page, "/manage/courses/[id]/pages")

  // Click text=New title!(/chapter-1/page-1) history >> :nth-match(a, 2)
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad/history' }*/),
    page.click("text=New title!(/chapter-1/page-1) history >> :nth-match(a, 2)"),
  ])

  const stableElement = await page.waitForSelector("text=core/paragraph")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "history-view-p1",
    waitForThisToBeVisibleAndStable: stableElement,
    toMatchSnapshotOptions: { threshold: 0.3 },
    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })

  // Click [aria-label="Go to page 4"]
  await page.click('[aria-label="Go to page 4"]')
  expectPath(page, "/manage/pages/[id]/history?page=4")

  const stableElement2 = await page.waitForSelector("text=core/paragraph")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "history-view-p4-before-compare",
    waitForThisToBeVisibleAndStable: stableElement2,
    toMatchSnapshotOptions: { threshold: 0.3 },
    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })

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

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "history-view-p4-after-compare",
    // wait for the diff to show up
    waitForThisToBeVisibleAndStable: [
      ".line-delete",
      ".line-insert",
      ".insert-sign",
      ".delete-sign",
    ],
  })

  // Click text=Restore
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad/history?page=1' }*/),
    page.click("text=Restore"),
  ])
  await page.click("text=Page edit history") // deselect restore
  await page.waitForSelector("[aria-label='page 1'][aria-current='true']")
  await page.waitForTimeout(100)

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "history-view-after-restore",
    waitForThisToBeVisibleAndStable: "text=Best exercise",
    toMatchSnapshotOptions: { threshold: 0.3 },
    beforeScreenshot: async () => {
      await replaceIdsAndTimesFromHistoryView(page)
    },
  })

  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click('[aria-label="Front page"]'),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await page.click("text=University of Helsinki, Department of Computer Science")
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

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

  // Click text=1New title!
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-history/chapter-1/page-1' }*/),
    page.click("text=1New title!"),
  ])

  await page.waitForLoadState("networkidle")
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "page-after-restore",
    waitForThisToBeVisibleAndStable: null,
  })
})

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
