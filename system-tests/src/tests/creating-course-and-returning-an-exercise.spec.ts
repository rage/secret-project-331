import { expect, test } from "@playwright/test"

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
  expect(page.url().startsWith("http://project-331.local/organizations/")).toBe(true)

  // Click text=Add course
  await page.click("text=Add course")

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "Introduction to System Level Testing")

  // Click text=Create course
  await page.click("text=Create course")

  // Click :nth-match(:text("Manage"), 3)
  await Promise.all([page.waitForNavigation(), page.click(':nth-match(:text("Manage"), 3)')])
  expect(page.url().startsWith("http://project-331.local/manage/courses/")).toBe(true)

  // Click text=Manage pages
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/1bd0eaef-ba4b-4c94-ba76-83ecab229274/pages' }*/),
    page.click("text=Manage pages"),
  ])

  // Click button:has-text("Add new chapter")
  await page.click('button:has-text("Add new chapter")')

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "The Levels of testing")

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Press ArrowRight
  await page.press('input[type="text"]', "ArrowRight")

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "The Levels of Testing")

  // Click button:has-text("Create chapter")
  await page.click('button:has-text("Create chapter")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.click(':nth-match(button:has-text("New page"), 2)')

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "Unit testing")

  // Click button:has-text("Create page")
  await page.click('button:has-text("Create page")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.click(':nth-match(button:has-text("New page"), 2)')

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "Integration Testing")

  // Click button:has-text("Create page")
  await page.click('button:has-text("Create page")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.click(':nth-match(button:has-text("New page"), 2)')

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "System Testing")

  // Click button:has-text("Create page")
  await page.click('button:has-text("Create page")')

  // Click :nth-match(button:has-text("New page"), 2)
  await page.click(':nth-match(button:has-text("New page"), 2)')

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "Acceptance Testing")

  // Click button:has-text("Create page")
  await page.click('button:has-text("Create page")')

  // Click text=System Testing
  await Promise.all([page.waitForNavigation(), page.click("text=System Testing")])
  expect(page.url().startsWith("http://project-331.local/cms/pages/")).toBe(true)

  // Click text=Type / to choose a block
  await page.click("text=Type / to choose a block")

  await page.keyboard.type("In system level testing, we test the system as a whole")
  await page.keyboard.press("Enter")
  await page.keyboard.type("/exercise")

  // Click :nth-match(:text("Exercise"), 3
  await page.click("text=Exercise")

  // Click [placeholder="Exercise name"]
  await page.click('[placeholder="Exercise name"]')
  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "What is system testing")

  // Click [aria-label="Add ExerciseTask"]
  await page.click('[aria-label="Add ExerciseTask"]')

  // Click text=Type / to choose a block
  await page.click("text=Type / to choose a block")

  await page.keyboard.type("Please select the most correct alternative.")

  // Click text=Example Exercise
  await page.click("text=Example Exercise")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/editor")
    }),
  )

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

  // Click button:has-text("Save")
  await page.click('button:has-text("Save")')

  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click("text=Home"),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url().startsWith("http://project-331.local/organizations/")).toBe(true)

  // Click text=Introduction to System Level Testing
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-system-level-testing' }*/),
    page.click("text=Introduction to System Level Testing"),
  ])

  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  // Click text=Chapter 1: The Levels of Testing
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-system-level-testing/chapter-1' }*/),
    page.click("text=Chapter 1: The Levels of Testing"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/courses/introduction-to-system-level-testing/chapter-1",
  )

  // Click text=System Testing
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-system-level-testing/chapter-1/system-testing' }*/),
    await page.click("text=System Testing"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/courses/introduction-to-system-level-testing/chapter-1/system-testing",
  )

  const frame2 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/example-exercise/exercise")
    }),
  )

  // Click text=Automatically testing the whole system
  await frame2.click("text=Automatically testing the whole system")

  // Click button:has-text("Submit")
  await page.click('button:has-text("Submit")')

  await page.waitForSelector("text=Good job!")
  await page.waitForSelector("text=Points:1/1")
})
