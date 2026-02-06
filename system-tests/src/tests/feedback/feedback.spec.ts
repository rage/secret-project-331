import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../utils/iframeLocators"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { feedbackTooltipTestId } from "@/shared-module/common/styles/constants"
import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("feedback test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.getByText("Introduction to feedback").click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("The Basics").click()

  await page.getByText("Page One").first().click()
  await page.locator(`text=Everything is a big topic`).waitFor()

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)

  await frame.getByText("b").waitFor()

  await page.click("text=So big", {
    clickCount: 3,
  })

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "feedback-tooltip",
    waitForTheseToBeVisibleAndStable: [page.getByTestId(feedbackTooltipTestId)],
  })

  await page.getByTestId(feedbackTooltipTestId).getByText("Give feedback").click()

  await page.getByText("Give written feedback").click()

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
  await page.getByText("Feedback submitted successfully").waitFor()

  await logout(page)
  await login("admin@example.com", "admin", page, true)

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.locator("[aria-label=\"Manage course 'Introduction to feedback'\"] svg").click()

  await Promise.all([page.getByRole("tab", { name: "Feedback 4" }).click()])

  // Makes sure the components have rendered so that the next waitForTheseToBeVisibleAndStable always works with the placeholder
  await page.getByText(`Page: Page One`).waitFor()

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

  await page.getByText("Mark as read").first().click()
  // We have to wait for the feedback item to disappear so that we don't accidentally click the same button multiple times. Computers are sometimes faster that one would expect.
  await page.getByText("I found this pretty confusing!").waitFor({ state: "hidden" })
  await page.getByText("Mark as read").first().click()
  await page.getByText("Anonymous unrelated feedback").waitFor({ state: "hidden" })
  await page.getByText("Mark as read").first().click()
  await page.getByText("Anonymous feedback").waitFor({ state: "hidden" })
  await page.getByText("Mark as read").first().click()
  await page.getByText("I dont think we need these paragraphs").waitFor({ state: "hidden" })
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

  await page.getByRole("button", { name: "Mark as unread" }).first().click()

  await page.getByRole("tab", { name: "Unread" }).click()
})
