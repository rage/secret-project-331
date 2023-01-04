import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }) => {
  test.slow()

  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-edit-proposals' }*/),
    page.locator("text=Introduction to edit proposals").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-edit-proposals/chapter-1' }*/),
    page.locator("text=The Basics").click(),
  ])

  await Promise.all([page.waitForNavigation(), page.locator("text=Page One").click()])

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )

  if (!frame) {
    throw new Error("Coudl not find frame")
  }

  await frame.waitForSelector("text=b")

  await page.locator("text=Give feedback").click()

  await page.locator("text=Improve material").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "no-edits-yet",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Click on course material to make it editable!"),
    ],
  })

  await page.locator("text=At vero eos et").click()

  await page.locator("text=So big, that we need many paragraphs.").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "currently-editing",
    waitForTheseToBeVisibleAndStable: [page.locator("text=You've selected material for editing")],
  })

  await page.locator("text=So big, that we need many paragraphs.").click()
  await page.fill(
    "text=So big, that we need many paragraphs.",
    "So big, that we need many paragraphs...",
  )

  await page.locator("text=Like this.").click()
  await page.locator("text=Like this.").click()
  await page.fill("text=Like this.", "Like this!")

  await page.click(
    "text=At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praese",
  )
  await page.click(
    "text=At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praese",
  )
  await page.press(
    "text=At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praese",
    "Control+a",
  )
  await page.fill(
    "text=At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praese",
    "redacted",
  )

  await page.locator("text=So big,").click()

  await page.click('button:has-text("Preview")')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "preview",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Send"`),
      page.locator(`text="You've made changes"`),
      page.locator(`text="Do you want to send your changes?"`),
    ],
  })

  await page.click('button:has-text("Send")')

  await page.waitForSelector("text=Feedback submitted successfully")

  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course 'Introduction to edit proposals'\"] svg").click(),
  ])

  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2",
  )

  await Promise.all([page.waitForNavigation(), page.locator("text=Change requests").click()])
  await page.locator("text=Accept").first().waitFor({ state: "visible" })
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2/change-requests",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "manage-initial",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Accept")],
  })

  await page.click(':nth-match(:text("Accept"), 1)')

  await page.click(':nth-match(:text("Edit and accept"), 2)')
  await page.fill('textarea:has-text("Like this!")', "Like this!!!!!")
  await page.click(':nth-match(:text("Reject"), 3)')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "manage-before-send",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Send")],
    beforeScreenshot: async () => {
      await page.evaluate(() => window.scrollTo(0, 0))
    },
  })

  await page.click('text="Send"')

  await page.click('text="Change requests"')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "manage-after-send",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Reject")],
    clearNotifications: true,
  })

  await page.click('text="Old"')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "manage-old-after-send",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Accepted")],
  })

  await page.locator("text=Pending 2").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2/change-requests?pending=true",
  )

  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator("text=Open page in new tab").first().click(),
  ])

  // Wait for the exercise to load because otherwise it might mess up the screenshot
  await page1
    .frameLocator(`[title="Exercise 1, task 1 content"]`)
    .locator(`button:text-is("a")`)
    .waitFor()

  await page1.locator(`text=Like this!!!!!`).scrollIntoViewIfNeeded()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page1,
    headless,
    snapshotName: "after-changes",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Like this!!!!!")],
  })
})
