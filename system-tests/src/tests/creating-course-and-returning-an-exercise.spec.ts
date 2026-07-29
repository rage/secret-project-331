/* oxlint-disable playwright/prefer-locator */
import { test } from "@playwright/test"

import { createCourse } from "@/utils/flows/newCourse.flow"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorsParentIframeToViewIfNeeded,
  waitForExerciseServiceIframeToBeStable,
} from "../utils/iframeLocators"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Creating a course an returning an exercise works", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  await createCourse(page, {
    name: "Introduction to System Level Testing",
    language: "English",
    teacherInChargeName: "teacher",
    teacherInChargeEmail: "teacher@example.com",
    description: "Course description",
  })

  await page
    .getByRole("link", { name: "Manage course 'Introduction to System Level Testing'" })
    .click()

  await page.getByRole("tab", { name: "Pages" }).click()

  const newChapterDialog = page.getByRole("dialog", { name: "New chapter" })

  await page.getByRole("button", { name: "New chapter" }).click()
  await newChapterDialog.waitFor()
  await newChapterDialog.getByLabel("Name", { exact: true }).fill("The Levels of testing")
  await newChapterDialog.getByLabel("Chapter number", { exact: true }).press("ArrowRight")
  await newChapterDialog.getByLabel("Name", { exact: true }).fill("The Levels of Testing")
  await newChapterDialog.getByRole("button", { name: "Create" }).click()
  await newChapterDialog.waitFor({ state: "hidden" })
  await page.getByRole("heading", { name: /Chapter 1: The Levels of Testing/ }).waitFor()

  // Unused by the assertions, but its presence is what makes the "New page" buttons below
  // Chapter 1 resolve the way the following steps expect.
  await page.getByRole("button", { name: "New chapter" }).click()
  await newChapterDialog.waitFor()
  await newChapterDialog.getByLabel("Name", { exact: true }).fill("Unit testing")
  await newChapterDialog.getByRole("button", { name: "Create" }).click()
  await newChapterDialog.waitFor({ state: "hidden" })
  await page.getByRole("heading", { name: /Chapter 2: Unit testing/ }).waitFor()

  const newPageDialog = page.getByRole("dialog", { name: "New page" })

  for (const pageTitle of ["Integration Testing", "System Testing", "Acceptance Testing"]) {
    await page.click(`:nth-match(button:has-text("New page"):below(:text("Chapter 1")), 1)`)
    await newPageDialog.waitFor()
    await newPageDialog.getByLabel("Title  *", { exact: true }).fill(pageTitle)
    await newPageDialog.getByRole("button", { name: "Create" }).click()
    // Wait for the dialog to go away before touching the page behind it: while the modal is up its
    // backdrop covers the "New page" buttons, and the page list re-renders as the new page lands.
    await newPageDialog.waitFor({ state: "hidden" })
    await page.getByRole("cell", { name: pageTitle, exact: true }).waitFor()
  }

  await page.click(`button:text("Edit page"):right-of(:text("System Testing"))`)

  await page.click('[aria-label="Add block"]')
  await page.keyboard.type("/paragraph")
  await page.click('button[role="option"]:has-text("Paragraph")')
  await page.keyboard.type("In system level testing, we test the system as a whole")
  await page.keyboard.press("Enter")
  await page.keyboard.type("/exercise")

  await page.click(`button:text("Exercise")`)

  await page.click('[placeholder="Exercise name"]')
  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "What is system testing")

  await page.click('[aria-label="Block: ExerciseTask"] [aria-label="Edit"]')

  await page.getByText("Type / to choose a block").click()

  await page.keyboard.type("Please select the most correct alternative.")

  await page.getByText("Example Exercise").click()

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)

  // The iframe resizes as the editor view loads; wait for it to settle so the click hits the button.
  await waitForExerciseServiceIframeToBeStable(page, "example-exercise", 1)
  await frame.getByText("New").first().click()

  await frame.locator(':nth-match([placeholder="Option text"], 1)').first().click()

  // Fill :nth-match(input, 2)
  await frame
    .locator(':nth-match([placeholder="Option text"], 1)')
    .fill("Manually reviewing the final system")

  // Adding the previous option grew the iframe; wait for the resize to settle before clicking again.
  await waitForExerciseServiceIframeToBeStable(page, "example-exercise", 1)
  await frame.getByText("New").first().click()

  await frame.locator(':nth-match([placeholder="Option text"], 2)').first().click()

  // Fill :nth-match(input, 4)
  await frame
    .locator(':nth-match([placeholder="Option text"], 2)')
    .fill("Automatically testing the whole system")

  // Adding the previous option grew the iframe; wait for the resize to settle before clicking again.
  await waitForExerciseServiceIframeToBeStable(page, "example-exercise", 1)
  await frame.getByText("New").first().click()

  await frame.locator(':nth-match([placeholder="Option text"], 3)').first().click()

  // Fill div:nth-child(3) .css-16b3rht
  await frame
    .locator(':nth-match([placeholder="Option text"], 3)')
    .fill("Testing one part of the system in isolation")

  // Check :nth-match(input[type="checkbox"], 2)
  await frame.locator(':nth-match(input[type="checkbox"], 2)').check()

  await waitForSuccessNotification(page, async () => {
    await page.click('button:text-is("Save") >> visible=true')
  })

  // Check that the assignment still displays after saving
  await page.click('[aria-label="Block: ExerciseTask"] [aria-label="Edit"]')
  await page.getByText(`Please select the most correct alternative.`).waitFor()

  await page.goto(`http://project-331.local/org/uh-cs/courses/introduction-to-system-level-testing`)

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("The Levels of Testing").click()
  await expectUrlPathWithRandomUuid(
    page,
    "/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1",
  )

  await page.getByText("System Testing").first().click()
  await expectUrlPathWithRandomUuid(
    page,
    "/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1/system-testing",
  )

  const frame2 = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
  await scrollLocatorsParentIframeToViewIfNeeded(frame2)

  // The iframe resizes as the answer view loads; wait for it to settle so the click hits the option.
  await waitForExerciseServiceIframeToBeStable(page, "example-exercise", 1)
  await frame2.getByText("Automatically testing the whole system").first().click()

  await page.locator("#content >> text=Submit").click()

  await Promise.all([
    page.locator('span.heading:has-text("POINTS")').waitFor(),
    page.locator('div.points:has-text("1/1")').waitFor(),
  ])
})
