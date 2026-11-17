/* oxlint-disable playwright/prefer-locator */
import { test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import {
  getLocatorForNthExerciseServiceIframe,
  getExerciseTaskIframe,
} from "../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Making proposed edits works", async ({ page, headless }, testInfo) => {
  test.slow()

  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.getByText("Introduction to edit proposals").click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("The Basics").click()

  await page.getByRole("link", { name: "1 Page One" }).click()

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)

  await frame.getByText("b").waitFor()

  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)

  await page.getByText("Give feedback").click()

  await page.getByText("Improve material").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["page-has-heading-one"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "no-edits-yet",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Select a paragraph or its Edit button to make it editable!"),
    ],
    skipMobile: true,
    scrollToYCoordinate: 920,
  })

  // The paragraph also has a hidden description copy of its text
  await page
    .getByText("The abacus is one of the oldest known calculating tools")
    .filter({ visible: true })
    .click()

  await page.getByText("So big, that we need many paragraphs.").filter({ visible: true }).click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["page-has-heading-one"],
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

  await page.getByText("So big, that we need many paragraphs.").filter({ visible: true }).click()
  await page.fill(
    "text=So big, that we need many paragraphs.",
    "So big, that we need many paragraphs...",
  )

  await page.getByText("Like this.").filter({ visible: true }).click()
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  await page.fill("text=Like this.", "Like this!")
  await page.click("text=The abacus is one of the oldest known calculating tools")
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  await page.fill(
    "text=The abacus is one of the oldest known calculating tools",
    "The abacus is the oldest known calculating tool, with origins tracing back to ancient Mesopotamia and China. Often consisting of a wooden frame with rows of beads, it has been used for centuries as a reliable aid in performing arithmetic operations. Its simplicity and effectiveness made it a cornerstone of commerce and education across many galaxies.",
  )

  await page.getByText("So big,").filter({ visible: true }).click()

  await page.click('button:has-text("Preview")')

  // Wait for the preview to load
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(200)

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["page-has-heading-one"],
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

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.locator("[aria-label=\"Manage course 'Introduction to edit proposals'\"] svg").click()

  await page.getByText("Feedback").click()
  await page.getByText("Feedback and change requests").last().waitFor()
  await page.getByRole("tab", { name: "Change requests" }).click()
  await page.getByText("Accept").first().waitFor({ state: "visible" })

  await page.getByRole("radio", { name: "Accept", exact: true }).nth(0).check()

  await page.getByRole("radio", { name: "Edit and accept", exact: true }).nth(1).check()
  await page.fill('textarea:has-text("Like this!")', "Like this!!!!!")
  await page.getByRole("radio", { name: "Reject", exact: true }).nth(2).check()

  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Send" }).first().click()
  })

  await page.click('text="Handled"')

  await page.getByRole("tab", { name: "Pending" }).click()

  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByText("Open page in new tab").first().click(),
  ])

  // Wait for the exercise to load because otherwise it might mess up the screenshot
  await getExerciseTaskIframe(page1, 1).contentFrame().locator(`button:text-is("a")`).waitFor()

  await page1.locator(`text=Like this!!!!!`).waitFor()
})
