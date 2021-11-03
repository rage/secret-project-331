import { expect, test } from "@playwright/test"
import { Page } from "playwright"

import { feedbackTooltipClass } from "../../shared-module/styles/constants"
import expectPath from "../../utils/expect"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test", async ({ headless, page }) => {
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

  await Promise.all([page.waitForNavigation(), page.click("text=Introduction to feedback")])

  await page.click('label:has-text("default")')

  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  await Promise.all([page.waitForNavigation(), await page.click("text=The Basics")])
  expect(page.url()).toBe("http://project-331.local/courses/introduction-to-feedback/chapter-1")

  await Promise.all([page.waitForNavigation(), await page.click("text=Page One")])
  expect(page.url()).toBe(
    "http://project-331.local/courses/introduction-to-feedback/chapter-1/page-1",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/exercise")
    }),
  )

  await frame.waitForSelector("text=b")

  await page.click("text=So big", {
    clickCount: 3,
  })

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "feedback-tooltip",
    waitForThisToBeVisibleAndStable: `.${feedbackTooltipClass}`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  // Click :nth-match(:text("Give feedback"), 2)
  await page.click(':nth-match(:text("Give feedback"), 2)')

  // Click textarea
  await page.click("textarea")

  // Fill textarea
  await page.fill(
    "textarea",
    "I found this pretty confusing! First of all, at vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.",
  )

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "feedback-input",
    waitForThisToBeVisibleAndStable: `text=I found this pretty confusing`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  // Click text=Submit
  await page.click('text="Add comment"')
  await page.click(`button:text("Send")`)
  await page.waitForSelector("text=Feedback submitted successfully")

  await logout(page)
  await login("admin@example.com", "admin", page, true)

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expectPath(page, "/organizations/[id]")

  // Click text=Introduction to feedback Manage >> :nth-match(a, 2)
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=Introduction to feedback Manage >> :nth-match(a, 2)"),
  ])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage feedback

  await Promise.all([page.waitForNavigation(), await page.click("text=Manage feedback")])
  await page.waitForURL((url) => url.searchParams.has("read"))
  expectPath(page, "/manage/courses/[id]/feedback?read=false")

  await replaceIds(page)

  // Unread feedback view
  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "feedback-unread",
    waitForThisToBeVisibleAndStable: `text=Sent by xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  // Click text=Mark as read
  await page.click("text=Mark as read")
  // We have to wait for the feedback item to disappear so that we don't accidentally click the same button multiple times. Computers are sometimes faster that one would expect.
  await page.waitForSelector("text=I found this pretty confusing!", { state: "hidden" })
  await page.click("text=Mark as read")
  await page.waitForSelector("text=Anonymous unrelated feedback", { state: "hidden" })
  await page.click("text=Mark as read")
  await page.waitForSelector("text=Anonymous feedback", { state: "hidden" })
  await page.click("text=Mark as read")
  await page.waitForSelector("text=I dont think we need these paragraphs", { state: "hidden" })
  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "feedback-empty",
    waitForThisToBeVisibleAndStable: `text=No feedback`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  // Click :nth-match(:text("Read"), 2)
  await page.click(':nth-match(:text("Read"), 2)')
  expectPath(page, "/manage/courses/[id]/feedback?read=true")

  // Click text=Mark as unread
  await page.click("text=Mark as unread")

  // Click text=Unread
  await page.click("text=Unread")
})

async function replaceIds(page: Page): Promise<void> {
  await page.waitForSelector("text=Sent by")
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && div.textContent.includes("Sent by")) {
        div.innerHTML = "Sent by xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx at yyyy-mm-ddThh:mm:ss.xxxZ"
      }
    }
  })

  await page.waitForSelector("text=Block id: ")
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && div.textContent.includes("Block id: ")) {
        div.innerHTML = "Block id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  })
}
