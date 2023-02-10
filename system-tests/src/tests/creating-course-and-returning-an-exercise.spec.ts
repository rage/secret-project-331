import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
import waitForFunction from "../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  // Click text=Add course
  await page.click(`button:text("Create")`)

  // Click input[type="text"]
  await page.click('input[type="radio"]')

  // Fill input[type="text"]
  await page.fill("text=Name", "Introduction to System Level Testing")

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  // Click text=Create course
  await page.click(`button:text("Create"):below(:text("Course language"))`)

  // Click :nth-match(:text("Manage"), 3)
  await Promise.all([
    page.waitForNavigation(),
    await page.click("[aria-label=\"Manage course 'Introduction to System Level Testing'\"] svg"),
  ])
  expect(page.url().startsWith("http://project-331.local/manage/courses/")).toBe(true)

  // Click text=Manage pages
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/1bd0eaef-ba4b-4c94-ba76-83ecab229274/pages' }*/),
    page.click("text=Pages"),
  ])

  // Click button:has-text("Add new chapter")
  await page.locator(`button:has-text("New chapter")`).last().click()

  // Fill input[type="text"]
  await page.fill("text=Name", "The Levels of testing")

  // Press ArrowRight
  await page.press("text=Chapter number", "ArrowRight")

  // Fill input[type="text"]
  await page.fill("text=Name", "The Levels of Testing")

  // Click button:has-text("Create chapter")
  await page.click('button:text("Create")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.locator(`button:has-text("New")`).last().click()

  // Fill input[type="text"]
  await page.fill("text=Name", "Unit testing")

  // Click button:has-text("Create")
  await page.click('button:text("Create")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.click(`:nth-match(button:has-text("New page"):below(:text("Chapter 1")), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "Integration Testing")

  // Click button:has-text("Create")
  await page.click('button:text("Create")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.click(`:nth-match(button:has-text("New page"):below(:text("Chapter 1")), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "System Testing")

  // Click button:has-text("Create")
  await page.click('button:text("Create")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.click(`:nth-match(button:has-text("New page"):below(:text("Chapter 1")), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "Acceptance Testing")

  // Click button:has-text("Create")
  await page.click('button:text("Create")')

  // Click text=System Testing
  await Promise.all([
    page.waitForNavigation(),
    page.click(`button:text("Edit page"):right-of(:text("System Testing"))`),
  ])
  expect(page.url().startsWith("http://project-331.local/cms/pages/")).toBe(true)

  // Click text=Type / to choose a block
  await page.click('[aria-label="Add block"]')
  await page.keyboard.type("/paragraph")
  await page.click('button[role="option"]:has-text("Paragraph")')
  await page.keyboard.type("In system level testing, we test the system as a whole")
  await page.keyboard.press("Enter")
  await page.keyboard.type("/exercise")

  // Click :nth-match(:text("Exercise"), 3
  await page.click(`button:text("Exercise")`)

  // Click [placeholder="Exercise name"]
  await page.click('[placeholder="Exercise name"]')
  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "What is system testing")

  // Click text=Add slide
  await page.click("text=Add slide")

  // The block needs to be focused for the button to work
  await page.waitForTimeout(100)
  await page.click("text=Slide 1")

  // Click text=Add task
  await page.click("text=Add task")

  // Click [aria-label="Block: ExerciseTask"] div[role="button"]
  await page.click('[aria-label="Block: ExerciseTask"] [aria-label="Edit"]')

  // Click text=Type / to choose a block
  await page.click("text=Type / to choose a block")

  await page.keyboard.type("Please select the most correct alternative.")

  // Click text=Example Exercise
  await page.click("text=Example Exercise")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )

  if (!frame) {
    throw new Error("Could not find frame")
  }

  // Click text=New
  await frame.click("text=New")

  // Click :nth-match(input, 2)
  await frame.click(':nth-match([placeholder="Option text"], 1)')

  // Fill :nth-match(input, 2)
  await frame.fill(
    ':nth-match([placeholder="Option text"], 1)',
    "Manually reviewing the final system",
  )

  // Click text=New
  await frame.click("text=New")

  // Click :nth-match(input, 4)
  await frame.click(':nth-match([placeholder="Option text"], 2)')

  // Fill :nth-match(input, 4)
  await frame.fill(
    ':nth-match([placeholder="Option text"], 2)',
    "Automatically testing the whole system",
  )

  // Click text=New
  await frame.click("text=New")

  // Click div:nth-child(3) .css-16b3rht
  await frame.click(':nth-match([placeholder="Option text"], 3)')

  // Fill div:nth-child(3) .css-16b3rht
  await frame.fill(
    ':nth-match([placeholder="Option text"], 3)',
    "Testing one part of the system in isolation",
  )

  // Check :nth-match(input[type="checkbox"], 2)
  await frame.check(':nth-match(input[type="checkbox"], 2)')

  // Click button:text-is("Save")
  await page.click('button:text-is("Save") >> visible=true')
  await page.waitForSelector(`text="Operation successful!"`)

  // Check that the assignment still displays after saving
  await page.click('[aria-label="Block: ExerciseTask"] [aria-label="Edit"]')
  await page.waitForSelector(`text="Please select the most correct alternative."`)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.getByRole("link", { name: "Home" }).click(),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click text=Introduction to System Level Testing
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-system-level-testing' }*/),
    page.click("text=Introduction to System Level Testing"),
  ])

  // Click button:has-text("Continue")
  await selectCourseInstanceIfPrompted(page)

  // Click text=Chapter 1: The Levels of Testing
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1' }*/),
    page.click("text=The Levels of Testing"),
  ])
  await expectUrlPathWithRandomUuid(
    page,
    "/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1",
  )

  // Click text=System Testing
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1/system-testing' }*/),
    await page.click("text=System Testing"),
  ])
  await expectUrlPathWithRandomUuid(
    page,
    "/org/uh-cs/courses/introduction-to-system-level-testing/chapter-1/system-testing",
  )

  const frame2 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/iframe")
    }),
  )
  if (!frame2) {
    throw new Error("Could not find frame2")
  }
  await (await frame2.frameElement()).scrollIntoViewIfNeeded()

  // Click text=Automatically testing the whole system
  await frame2.click("text=Automatically testing the whole system")

  // Click #content >> text=Submit
  await page.click("#content >> text=Submit")

  await page.waitForSelector("text=Points:1/1")
})
