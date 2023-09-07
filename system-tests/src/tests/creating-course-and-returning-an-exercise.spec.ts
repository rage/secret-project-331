import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorsParentIframeToViewIfNeeded,
} from "../utils/iframeLocators"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  await page.click(`button:text("Create")`)

  await page.click('input[type="radio"]')

  // Fill input[type="text"]
  await page.fill("text=Name", "Introduction to System Level Testing")

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  await page.click(`button:text("Create"):below(:text("Course language"))`)

  await page
    .locator("[aria-label=\"Manage course 'Introduction to System Level Testing'\"] svg")
    .click()

  await page.locator("text=Pages").click()

  await page.locator(`button:has-text("New chapter")`).last().click()

  // Fill input[type="text"]
  await page.fill("text=Name", "The Levels of testing")

  await page.press("text=Chapter number", "ArrowRight")

  // Fill input[type="text"]
  await page.fill("text=Name", "The Levels of Testing")

  await page.click('button:text("Create")')

  await page.locator(`button:has-text("New")`).last().click()

  // Fill input[type="text"]
  await page.fill("text=Name", "Unit testing")

  await page.click('button:text("Create")')

  await page.click(`:nth-match(button:has-text("New page"):below(:text("Chapter 1")), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "Integration Testing")

  await page.click('button:text("Create")')

  await page.click(`:nth-match(button:has-text("New page"):below(:text("Chapter 1")), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "System Testing")

  await page.click('button:text("Create")')

  await page.click(`:nth-match(button:has-text("New page"):below(:text("Chapter 1")), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "Acceptance Testing")

  await page.click('button:text("Create")')

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

  await page.locator("text=Add slide").click()

  // The block needs to be focused for the button to work
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  await page.locator("text=Slide 1").click()

  await page.locator("text=Add task").click()

  await page.click('[aria-label="Block: ExerciseTask"] [aria-label="Edit"]')

  await page.locator("text=Type / to choose a block").click()

  await page.keyboard.type("Please select the most correct alternative.")

  await page.locator("text=Example Exercise").click()

  const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)

  await frame.locator("text=New").first().click()

  await frame.locator(':nth-match([placeholder="Option text"], 1)').first().click()

  // Fill :nth-match(input, 2)
  await frame
    .locator(':nth-match([placeholder="Option text"], 1)')
    .fill("Manually reviewing the final system")

  await frame.locator("text=New").first().click()

  await frame.locator(':nth-match([placeholder="Option text"], 2)').first().click()

  // Fill :nth-match(input, 4)
  await frame
    .locator(':nth-match([placeholder="Option text"], 2)')
    .fill("Automatically testing the whole system")

  await frame.locator("text=New").first().click()

  await frame.locator(':nth-match([placeholder="Option text"], 3)').first().click()

  // Fill div:nth-child(3) .css-16b3rht
  await frame
    .locator(':nth-match([placeholder="Option text"], 3)')
    .fill("Testing one part of the system in isolation")

  // Check :nth-match(input[type="checkbox"], 2)
  await frame.locator(':nth-match(input[type="checkbox"], 2)').check()

  await page.click('button:text-is("Save") >> visible=true')
  await page.waitForSelector(`text="Operation successful!"`)

  // Check that the assignment still displays after saving
  await page.click('[aria-label="Block: ExerciseTask"] [aria-label="Edit"]')
  await page.waitForSelector(`text="Please select the most correct alternative."`)

  await page.goto(`http://project-331.local/org/uh-cs/courses/introduction-to-system-level-testing`)

  await selectCourseInstanceIfPrompted(page)

  await page.locator("text=The Levels of Testing").click()
  await expectUrlPathWithRandomUuid(
    page,
    "/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1",
  )

  await page.locator("text=System Testing").first().click()
  await expectUrlPathWithRandomUuid(
    page,
    "/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1/system-testing",
  )

  const frame2 = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
  await scrollLocatorsParentIframeToViewIfNeeded(frame2)

  await frame2.locator("text=Automatically testing the whole system").first().click()

  await page.locator("#content >> text=Submit").click()

  await page.waitForSelector("text=Points:1/1")
})
