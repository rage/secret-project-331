import { expect, test } from "@playwright/test"
import { Page } from "playwright"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }) => {
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
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-edit-proposals/chapter-1/page-1' }*/),
    page.click("text=Page One"),
  ])

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
    page.click("text=Introduction to edit proposals Manage >> :nth-match(a, 2)"),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2",
  )

  // Click text=Manage change requests
  await Promise.all([page.waitForNavigation(), page.click("text=Manage change requests")])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2/change-requests?pending=true",
  )

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "manage-initial",
    waitForThisToBeVisibleAndStable: "text=Accept",
    beforeScreenshot: async () => {
      await replaceIds(page)
    },
  })

  await page.click(':nth-match(:text("Accept"), 1)')

  await page.click(':nth-match(:text("Edit and accept"), 2)')
  await page.fill('textarea:has-text("Like this!")', "Like this!!!!!")
  await page.click(':nth-match(:text("Reject"), 3)')

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "manage-before-send",
    waitForThisToBeVisibleAndStable: "text=Send",
    beforeScreenshot: async () => {
      await replaceIds(page)
    },
  })

  await page.click('text="Send"')

  await page.click('text="Change requests"')

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "manage-after-send",
    waitForThisToBeVisibleAndStable: "text=Reject",
    beforeScreenshot: async () => {
      await replaceIds(page)
    },
  })

  await page.click('text="Old"')

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "manage-old-after-send",
    waitForThisToBeVisibleAndStable: ".MuiTabs-indicator",
    beforeScreenshot: async () => {
      await replaceIds(page)
    },
  })

  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  // Click text=Introduction to edit proposals
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-edit-proposals' }*/),
    page.click("text=Introduction to edit proposals"),
  ])

  // Click text=The Basics
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-edit-proposals/chapter-1' }*/),
    page.click("text=The Basics"),
  ])

  // Click text=Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-edit-proposals/chapter-1/page-1' }*/),
    page.click("text=Page One"),
  ])

  await page.click("text=At vero")
  await page.click("text=So big")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "after-changes",
    waitForThisToBeVisibleAndStable: "text=Like this!!!!!",
  })
})

async function replaceIds(page: Page): Promise<void> {
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && div.textContent.includes("Page: ")) {
        div.innerHTML = 'Page: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"'
      }
    }
  })
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && div.textContent.includes("Block id: ")) {
        div.innerHTML = "Block id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  })
  await page.waitForSelector("text=Sent by")
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && div.textContent.includes("Sent by")) {
        div.innerHTML = "Sent by xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx at yyyy-mm-ddThh:mm:ss.xxxZ"
      }
    }
  })
}
