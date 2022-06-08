import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }) => {
  test.slow()
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Introduction to edit proposals
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-edit-proposals' }*/),
    page.click("text=Introduction to edit proposals"),
  ])

  // Click label:has-text("default")
  await page.click('label:has-text("default")')

  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  // Click text=The Basics
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-edit-proposals/chapter-1' }*/),
    page.click("text=The Basics"),
  ])

  // Click text=Page One
  await Promise.all([page.waitForNavigation(), page.click("text=Page One")])

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )

  await frame.waitForSelector("text=b")

  // Click text=Give feedback
  await page.click("text=Give feedback")

  // Click text=Improve material
  await page.click("text=Improve material")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "no-edits-yet",
    waitForThisToBeVisibleAndStable: "text=Click on course material to make it editable!",
  })

  await page.click("text=At vero eos et")

  await page.click("text=So big, that we need many paragraphs.")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "currently-editing",
    waitForThisToBeVisibleAndStable: "text=You've selected material for editing",
  })

  await page.click("text=So big, that we need many paragraphs.")
  await page.fill(
    "text=So big, that we need many paragraphs.",
    "So big, that we need many paragraphs...",
  )

  await page.click("text=Like this.")
  await page.click("text=Like this.")
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

  await page.click("text=So big,")

  // Click button:has-text("Send")
  await page.click('button:has-text("Preview")')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "preview",
    waitForThisToBeVisibleAndStable: [
      `text="Send"`,
      `text="You've made changes"`,
      `text="Do you want to send your changes?"`,
    ],
  })

  // Click button:has-text("Send")
  await page.click('button:has-text("Send")')

  await page.waitForSelector("text=Feedback submitted successfully")

  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  // Click text=Introduction to edit proposals Manage >> :nth-match(a, 2)
  await Promise.all([
    page.waitForNavigation(),
    page.click("[aria-label=\"Manage course 'Introduction to edit proposals'\"] svg"),
  ])

  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2",
  )

  // Click text=Manage change requests
  await Promise.all([page.waitForNavigation(), page.click("text=Change requests")])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2/change-requests",
  )

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "manage-initial",
    waitForThisToBeVisibleAndStable: "text=Accept",
  })

  await page.click(':nth-match(:text("Accept"), 1)')

  await page.click(':nth-match(:text("Edit and accept"), 2)')
  await page.fill('textarea:has-text("Like this!")', "Like this!!!!!")
  await page.click(':nth-match(:text("Reject"), 3)')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "manage-before-send",
    waitForThisToBeVisibleAndStable: "text=Send",
    beforeScreenshot: async () => {
      await page.evaluate(() => window.scrollTo(0, 0))
    },
  })

  await page.click('text="Send"')

  await page.click('text="Change requests"')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "manage-after-send",
    waitForThisToBeVisibleAndStable: "text=Reject",
    clearNotifications: true,
  })

  await page.click('text="Old"')

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "manage-old-after-send",
    waitForThisToBeVisibleAndStable: "text=Accepted",
  })

  await page.locator("text=Pending 2").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2/change-requests?pending=true",
  )
  // Click text=Open page in new tab >> nth=0
  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator("text=Open page in new tab").first().click(),
  ])

  await page1.locator(`text=Like this!!!!!`).scrollIntoViewIfNeeded()

  await expectScreenshotsToMatchSnapshots({
    page: page1,
    headless,
    snapshotName: "after-changes",
    waitForThisToBeVisibleAndStable: "text=Like this!!!!!",
  })
})
