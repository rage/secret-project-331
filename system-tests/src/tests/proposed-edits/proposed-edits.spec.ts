import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { selectOrganization } from "@/utils/organizationUtils"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Making proposed edits works", async ({ page, headless }, testInfo) => {
  test.slow()

  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    await selectOrganization(page, "University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.getByText("Introduction to edit proposals").click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("The Basics").click()

  await Promise.all([page.getByRole("link", { name: "1 Page One" }).click()])

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)

  await frame.getByText("b").waitFor()

  await page.getByText("Give feedback").click()

  await page.getByText("Improve material").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "no-edits-yet",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Click on course material to make it editable!"),
    ],
  })

  await page.getByText("At vero eos et").click()

  await page.getByText("So big, that we need many paragraphs.").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "currently-editing",
    waitForTheseToBeVisibleAndStable: [page.getByText("You've selected material for editing")],
  })

  await page.getByText("So big, that we need many paragraphs.").click()
  await page.fill(
    "text=So big, that we need many paragraphs.",
    "So big, that we need many paragraphs...",
  )

  await page.getByText("Like this.").click()
  await page.getByText("Like this.").click()
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

  await page.getByText("So big,").click()

  await page.click('button:has-text("Preview")')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "preview",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Send"`),
      page.locator(`text="You've made changes"`),
      page.locator(`text="Do you want to send your changes?"`),
    ],
  })

  await page.click('button:has-text("Send")')

  await page.getByText("Feedback submitted successfully").waitFor()

  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    await selectOrganization(page, "University of Helsinki, Department of Computer Science"),
  ])

  await page.locator("[aria-label=\"Manage course 'Introduction to edit proposals'\"] svg").click()

  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2",
  )

  await page.getByText("Change requests").click()
  await page.getByText("Accept").first().waitFor({ state: "visible" })
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2/change-requests",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "manage-initial",
    waitForTheseToBeVisibleAndStable: [page.getByText("Accept").first()],
  })

  await page.click(':nth-match(:text("Accept"), 1)')

  await page.click(':nth-match(:text("Edit and accept"), 2)')
  await page.fill('textarea:has-text("Like this!")', "Like this!!!!!")
  await page.click(':nth-match(:text("Reject"), 3)')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "manage-before-send",
    waitForTheseToBeVisibleAndStable: [page.getByText("Send").first()],
    beforeScreenshot: async () => {
      await page.evaluate(() => window.scrollTo(0, 0))
    },
  })

  await page.click('text="Send"')

  await page.getByText("Operation successful!").waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "manage-after-send",
    waitForTheseToBeVisibleAndStable: [page.getByText("Reject").first()],
    clearNotifications: true,
    scrollToYCoordinate: 0,
  })

  await page.click('text="Old"')

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "manage-old-after-send",
    waitForTheseToBeVisibleAndStable: [page.getByText("Accepted").first()],
    scrollToYCoordinate: 0,
  })

  await page.getByText("Pending 2").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/cae7da38-9486-47da-9106-bff9b6a280f2/change-requests?pending=true",
  )

  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByText("Open page in new tab").first().click(),
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
    testInfo,
    snapshotName: "after-changes",
    waitForTheseToBeVisibleAndStable: [page1.getByText("Like this!!!!!")],
    scrollToYCoordinate: 0,
  })
})
