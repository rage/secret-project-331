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

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.getByText("Introduction to edit proposals").click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("The Basics").click()

  await Promise.all([page.getByRole("link", { name: "1 Page One" }).click()])

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)

  await frame.getByText("b").waitFor()

  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)

  await page.getByText("Give feedback").click()

  await page.getByText("Improve material").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "no-edits-yet",
    waitForTheseToBeVisibleAndStable: [page.getByText("Click on a paragraph to make it editable!")],
    skipMobile: true,
    scrollToYCoordinate: 920,
  })

  await page.getByText("The abacus is one of the oldest known calculating tools").click()

  await page.getByText("So big, that we need many paragraphs.").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "currently-editing",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Now, type your proposed changes directly into the content"),
    ],
    skipMobile: true,
    scrollToYCoordinate: 920,
  })

  await page.getByText("So big, that we need many paragraphs.").click()
  await page.fill(
    "text=So big, that we need many paragraphs.",
    "So big, that we need many paragraphs...",
  )

  await page.getByText("Like this.").click()
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  await page.fill("text=Like this.", "Like this!")
  await page.click("text=The abacus is one of the oldest known calculating tools")
  await page.fill(
    "text=The abacus is one of the oldest known calculating tools",
    "The abacus is the oldest known calculating tool, with origins tracing back to ancient Mesopotamia and China. Often consisting of a wooden frame with rows of beads, it has been used for centuries as a reliable aid in performing arithmetic operations. Its simplicity and effectiveness made it a cornerstone of commerce and education across many galaxies.",
  )

  await page.getByText("So big,").click()

  await page.click('button:has-text("Preview")')

  // Wait for the preview to load
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(200)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "preview",
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("button", { name: "Send" }),
      page.getByText(
        "Send your proposal to review or select another paragraph to make more changes",
      ),
    ],
    skipMobile: true,
    scrollToYCoordinate: 920,
  })

  await page.getByRole("button", { name: "Send" }).click()

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

  await page.click(':nth-match(:text("Accept"), 1)')

  await page.click(':nth-match(:text("Edit and accept"), 2)')
  await page.fill('textarea:has-text("Like this!")', "Like this!!!!!")
  await page.click(':nth-match(:text("Reject"), 3)')

  await page.click('text="Send"')

  await page.getByText("Operation successful!").waitFor()

  await page.click('text="Old"')

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

  await page1.locator(`text=Like this!!!!!`).waitFor()
})
