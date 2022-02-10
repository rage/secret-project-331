import { Frame, Page, test } from "@playwright/test"

import expectPath from "../../utils/expect"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("create quizzes test", async ({ page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expectPath(page, "/org/uh-cs")

  // Click text=Add course
  await page.click(`button:text("Create")`)

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "quizzes test")

  await page.fill('input[id="teacher-in-charge-name"]', "teacher")
  await page.fill('input[id="teacher-in-charge-email"]', "teacher@example.com")

  // Click text=Create course
  await page.click(`button:text("Create"):below(:text("Course language"))`)

  // TODO: The next click sometimes fails because we click before the modal has closed.
  // Maybe we should wait for a success notification first?
  await page.waitForTimeout(100)

  await Promise.all([
    page.waitForNavigation(),
    page.click("[aria-label=\"Manage course 'quizzes test'\"] svg"),
  ])
  // Click :nth-match(:text("Manage"), 4)

  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Manage pages")])
  expectPath(page, "/manage/courses/[id]/pages")

  // Click text=Add new chapter
  await page.click(`:nth-match(button:has-text("New"):below(:text("Chapters")), 1)`)

  // Click input[type="text"]
  // await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill("text=Name", "first")

  // Click text=Create chapter
  await page.click(`button:text("Create")`)

  // Click :nth-match(:text("New page"), 2)
  await page.click(`:nth-match(button:text("New"):below(:text("Chapter 1")), 1)`)

  // Click input[type="text"]
  // await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill("text=Title", "first page")

  // Click text=Create
  await page.click(`button:text("Create")`)

  // Click text=first page
  await Promise.all([page.waitForNavigation(), page.click('a:has-text("first page")')])

  // Click :nth-match([aria-label="Add block"], 2)
  await page.click(':nth-match([aria-label="Add block"], 1)')

  // Click [placeholder="Search"]
  await page.click('[placeholder="Search"]')

  // Fill [placeholder="Search"]
  await page.fill('[placeholder="Search"]', "exercise")

  // Click button[role="option"]:has-text("Exercise")
  await page.click('button[role="option"]:has-text("Exercise")')

  // Click [aria-label="Block: Exercise"] div:has-text("Exercise")
  await page.click('[aria-label="Block: Exercise"]')

  // Click [placeholder="Exercise name"]
  await page.click('[placeholder="Exercise name"]')

  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "quizzes test")

  // Click text=Add slide
  await page.click("text=Add slide")

  // Click text=Add task
  await page.click("text=Add task")

  // Click [aria-label="Block: ExerciseTask"] div[role="button"]
  await page.click('[aria-label="Block: ExerciseTask"] div[role="button"]')

  // Click text=Quizzes
  await page.click("text=Quizzes")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  await frame.click(`button:text("Essay")`)
  await frame.fill(`label:has-text("Min words") input`, "100")
  await frame.fill(`label:has-text("Max words") input`, "500")

  await frame.click(`button:text("Scale")`)
  await frame.fill(`label:has-text("Title") input`, "Answer this question 1-6")
  await frame.fill(`label:has-text("Minimum") input`, "1")
  await frame.fill(`label:has-text("Maximum") input`, "6")

  await frame.click(`button:text("Open")`)
  await frame.fill(`label:has-text("Validity regular expression") input`, `1\\/2`)
  await frame.fill(`label:has-text("Format regular expression") input`, `\\d+\\/\\d+`)
  await frame.click(
    `:nth-match(button:text("Test"):right-of(label:has-text("Format regular expression")), 1)`,
  )
  await frame.fill(`label:has-text("Test") input`, `5`)
  await frame.waitForSelector(`text="Given text does not match regular expression"`)
  await frame.fill(`label:has-text("Test") input`, `1/2`)
  await frame.waitForSelector(`text="Given text matches regular expression"`)
  await closeModal(page, frame)

  await frame.click(`:nth-match(button:text("Multiple-Choice"), 1)`)
  await frame.fill(`label:has-text("Title") input`, `What is the answer to this question?`)
  await frame.click(`button:text("Add option")`)
  await frame.click(`button:text("Add option")`)
  await frame.click(`[aria-label="Option 1"]`)
  await frame.fill(`label:has-text("Option title") input`, `wrong`)
  await frame.fill(`label:has-text("Failure message") input`, `no`)
  await closeModal(page, frame)
  await frame.click(`[aria-label="Option 2"]`)
  await page.evaluate(() => {
    window.scrollBy(0, -300)
  })
  await frame.check(`input[type="checkbox"]`)
  await frame.fill(`label:has-text("Option title") input`, `correct`)
  await frame.fill(`label:has-text("Success message") input`, `yes`)
  await closeModal(page, frame)

  await frame.click(`button:text("Checkbox")`)
  await frame.fill(`label:has-text("Title") input:below(h4:text("checkbox"))`, `Please check this`)

  await frame.click(`button:text("Matrix")`)
  await frame.fill(`tr:nth-child(1) td:nth-child(1) input`, "1")
  await frame.fill(`tr:nth-child(1) td:nth-child(2) input`, "2")
  await frame.fill(`tr:nth-child(2) td:nth-child(1) input`, "3")
  await frame.fill(`tr:nth-child(2) td:nth-child(2) input`, "4")

  // rest quiz item types created on their own tasks
  // multiple choice dropdown
  await page.click(`[aria-label="Close"]`)
  await page.click(`text="Add task"`)
  await page.click(`:nth-match([aria-label="Edit"], 2)`)
  await page.click(`text="Quizzes"`)
  const frame2 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )
  await scrollToFrame(page, frame2)
  await frame2.click(`:nth-match(button:text("Multiple-choice-dropdown"), 1)`)
  await frame2.fill(`label:has-text("Title") input`, `Select correct option from dropdown`)
  await frame2.click(`button:text("Add option")`)
  await frame2.click(`button:text("Add option")`)
  await frame2.click(`[aria-label="Option 1"]`)
  await frame2.fill(`label:has-text("Option title") input`, `wrong`)
  await frame2.fill(`label:has-text("Failure message") input`, `no`)
  await closeModal(page, frame2)
  await frame2.click(`[aria-label="Option 2"]`)
  await frame2.check(`input[type="checkbox"]`)
  await frame2.fill(`label:has-text("Option title") input`, `correct`)
  await frame2.fill(`label:has-text("Success message") input`, `yes`)
  await closeModal(page, frame2)

  // clickable multiple choice
  await page.click(`[aria-label="Close"]`)
  await page.click(`text="Add task"`)
  await page.click(`:nth-match([aria-label="Edit"], 3)`)
  await page.click(`text="Quizzes"`)
  const frame3 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )
  await scrollToFrame(page, frame3)
  await frame3.click(`:nth-match(button:text("Clickable-multiple-choice"), 1)`)
  await frame3.fill(`label:has-text("Title") input`, `Select correct option from dropdown`)
  await frame3.click(`button:text("Add option")`)
  await frame3.click(`button:text("Add option")`)
  await frame3.click(`[aria-label="Option 1"]`)
  await frame3.fill(`label:has-text("Option title") input`, `wrong`)
  await frame3.fill(`label:has-text("Failure message") input`, `no`)
  await closeModal(page, frame3)
  await frame3.click(`[aria-label="Option 2"]`)
  await frame3.check(`input[type="checkbox"]`)
  await frame3.fill(`label:has-text("Option title") input`, `correct`)
  await frame3.fill(`label:has-text("Success message") input`, `yes`)
  await closeModal(page, frame3)

  // Click text=Save
  await page.click("text=Save")
})

async function closeModal(page: Page, frame: Frame) {
  const closeButtonLocator = frame.locator(`[aria-label="Close"]`)
  const handle = await closeButtonLocator.elementHandle()
  const boundingBox = await handle.boundingBox()
  const y = boundingBox.y
  await page.evaluate((y) => {
    window.scrollTo(0, y)
  }, y)
  const frameElement = await frame.frameElement()
  frameElement.scrollIntoViewIfNeeded()
  await frame.click(`[aria-label="Close"]`)
  await frame.waitForTimeout(100)
}

async function scrollToFrame(page: Page, frame: Frame) {
  const frameElement = await frame.frameElement()
  const boundingBox = await frameElement.boundingBox()
  const y = boundingBox.y
  await page.evaluate((y) => {
    window.scrollTo(0, y)
  }, y)
}
