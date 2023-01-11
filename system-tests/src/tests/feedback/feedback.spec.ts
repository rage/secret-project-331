import { expect, test } from "@playwright/test"

import { feedbackTooltipClass } from "../../shared-module/styles/constants"
import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../../utils/expect"
import { getLocatorForNthExerciseServiceIframe } from "../../utils/iframeLocators"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("feedback test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    await page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=Introduction to feedback").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([page.waitForNavigation(), page.locator("text=The Basics").click()])
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-feedback/chapter-1",
  )

  await Promise.all([page.waitForNavigation(), page.locator("text=Page One").first().click()])
  await page.locator(`text=Everything is a big topic`).waitFor()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-feedback/chapter-1/page-1",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)

  await frame.locator("text=b").waitFor()

  await page.click("text=So big", {
    clickCount: 3,
  })

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "feedback-tooltip",
    waitForTheseToBeVisibleAndStable: [page.locator(`.${feedbackTooltipClass}`)],
  })

  await page.click(':nth-match(:text("Give feedback"), 2)')

  await page.locator("textarea").click()

  // Fill textarea
  await page.fill(
    "textarea",
    "I found this pretty confusing! First of all, at vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "feedback-input",
    waitForTheseToBeVisibleAndStable: [page.locator(`text=I found this pretty confusing`)],
  })

  await page.click(`button:text("Add comment")`)
  await page.click(`button:text("Send")`)
  await page.waitForSelector("text=Feedback submitted successfully")

  await logout(page)
  await login("admin@example.com", "admin", page, true)

  await Promise.all([
    page.waitForNavigation(),
    await page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course 'Introduction to feedback'\"] svg").click(),
  ])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  await Promise.all([
    page.waitForNavigation(),
    page.getByRole("tab", { name: "Feedback 4" }).click(),
  ])
  // await page.waitForURL((url) => url.searchParams.has("read"))
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/feedback")

  // Makes sure the components have rendered so that the next waitForTheseToBeVisibleAndStable always works with the placeholder
  await page.waitForSelector(`text="Page: Page One"`)

  // Unread feedback view
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "feedback-unread",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=Sent by: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).first(),
    ],
  })

  await page.locator("text=Mark as read").first().click()
  // We have to wait for the feedback item to disappear so that we don't accidentally click the same button multiple times. Computers are sometimes faster that one would expect.
  await page.waitForSelector("text=I found this pretty confusing!", { state: "hidden" })
  await page.locator("text=Mark as read").first().click()
  await page.waitForSelector("text=Anonymous unrelated feedback", { state: "hidden" })
  await page.locator("text=Mark as read").first().click()
  await page.waitForSelector("text=Anonymous feedback", { state: "hidden" })
  await page.locator("text=Mark as read").first().click()
  await page.waitForSelector("text=I dont think we need these paragraphs", { state: "hidden" })
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "feedback-empty",
    waitForTheseToBeVisibleAndStable: [page.locator(`text=No feedback`)],
    beforeScreenshot: async () => {
      page.evaluate(() => {
        window.scrollTo({ top: 0, left: 0 })
      })
    },
    clearNotifications: true,
  })

  await page.click(':nth-match(:text("Read"), 2)')
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/feedback?read=true")

  await page.locator("text=Mark as unread").click()

  await page.locator("text=Unread").click()
})
