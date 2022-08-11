import { Frame, Page, test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../../utils/expect"
import { closeModal, fillQuizItemOptionModal } from "../../utils/quizzesActions"
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
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  // Click text=Add course
  await page.click(`button:text("Create")`)

  // Click input[type="text"]
  await page.click('input[type="radio"]')

  // Fill input[type="text"]
  await page.fill("text=Name", "exercise test")

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  // Click text=Create course
  await page.click(`button:text("Create"):below(:text("Course language"))`)

  await page.waitForSelector("text=Operation successful!")

  await Promise.all([
    page.waitForNavigation(),
    page.click(`a[aria-label="Manage course 'exercise test'"]`),
  ])
  // Click :nth-match(:text("Manage"), 4)

  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Pages")])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")

  // Click text=Add new chapter
  await page.click(`:nth-match(button:has-text("New chapter"), 1)`)

  // Click input[type="text"]
  // await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill(`label:has-text("Name")`, "first")

  // Click text=Create chapter
  await page.click(`button:text("Create")`)

  await page.waitForSelector(`text=Chapter 1`)

  // Click :nth-match(:text("New page"), 2)
  await page.click(`:nth-match(button:text("New page"):below(:text("Chapter 1")), 1)`)

  // Click input[type="text"]
  // await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "first page")

  // Click text=Create
  await page.click(`button:text("Create")`)

  // Click text=first page
  await Promise.all([
    page.waitForNavigation(),
    page.click(`button:text("Edit page"):right-of(:text("first page"))`),
  ])

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

  // The block needs to be focused for the button to work
  await page.waitForTimeout(100)
  await page.click("text=Slide 1")

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

  if (!frame) {
    throw new Error("Frame not found")
  }

  await frame.click(`#quiz-option-card-essay`)
  await frame.fill(`label:has-text("Min words") input`, "100")
  await frame.fill(`label:has-text("Max words") input`, "500")

  await page.click(`[aria-label="Close"]`)

  // Click text=Add task
  await page.click("text=Add task")

  // Click [aria-label="Edit"] >> nth=1
  await page.locator('[aria-label="Edit"]').nth(1).click()

  // Click text=Quizzes
  await page.locator("text=Quizzes").click()

  const frame2 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )
  if (!frame2) {
    throw new Error("Frame2 not found")
  }
  await scrollToFrame(page, frame2)

  await frame2.click(`#quiz-option-card-scale`)
  await frame2.fill(`label:has-text("Title") input`, "Answer this question 1-6")
  await frame2.fill(`label:has-text("Minimum") input`, "1")
  await frame2.fill(`label:has-text("Maximum") input`, "6")

  await page.click(`[aria-label="Close"]`)

  // Click text=Add task
  await page.click("text=Add task")

  // Click [aria-label="Edit"] >> nth=1
  await page.locator('[aria-label="Edit"]').nth(2).click()

  // Click text=Quizzes
  await page.locator("text=Quizzes").click()

  const frame3 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )
  if (!frame3) {
    throw new Error("Frame3 not found")
  }
  await scrollToFrame(page, frame3)

  await frame3.click(`#quiz-option-card-open`)
  await frame3.fill(`label:has-text("Validity regular expression") input`, `1\\/2`)
  await frame3.fill(`label:has-text("Format regular expression") input`, `\\d+\\/\\d+`)
  await frame3.click(
    `:nth-match(button:text("Test"):right-of(label:has-text("Format regular expression")), 1)`,
  )
  await frame3.fill(`label:has-text("Test") input`, `5`)
  await frame3.waitForSelector(`text="Given text does not match regular expression"`)
  await frame3.fill(`label:has-text("Test") input`, `1/2`)
  await frame3.waitForSelector(`text="Given text matches regular expression"`)
  await closeModal(page, frame3)

  await page.click(`[aria-label="Close"]`)
  // Click text=Add task
  await page.click("text=Add task")

  // Click [aria-label="Edit"] >> nth=3
  await page.locator('[aria-label="Edit"]').nth(3).click()

  // Click text=Quizzes
  await page.locator("text=Quizzes").click()

  const frame4 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )
  if (!frame4) {
    throw new Error("Frame4 not found")
  }
  await scrollToFrame(page, frame4)

  await frame4.click(`#quiz-option-card-multiple-choice`)
  await frame4.fill(`label:has-text("Title") input`, `What is the answer to this question?`)
  await frame4.click(`button:text("Add option")`)
  await frame4.click(`button:text("Add option")`)
  await frame4.click(`[aria-label="Option 1"]`)
  await fillQuizItemOptionModal(page, frame4, {
    type: "multiple-choice",
    correct: false,
    title: `wrong`,
    messageAfterSubmissionWhenSelected: `no`,
  })
  await frame4.click(`[aria-label="Option 2"]`)
  await page.evaluate(() => {
    window.scrollBy(0, 200)
  })
  await fillQuizItemOptionModal(page, frame4, {
    type: "multiple-choice",
    correct: true,
    title: `correct`,
    messageAfterSubmissionWhenSelected: `yes`,
  })

  await page.click(`[aria-label="Close"]`)

  // Click text=Add task
  await page.click("text=Add task")

  // Click [aria-label="Edit"] >> nth=4
  await page.locator('[aria-label="Edit"]').nth(4).click()

  // Click text=Quizzes
  await page.locator("text=Quizzes").click()

  const frame5 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )
  if (!frame5) {
    throw new Error("Frame5 not found")
  }
  await scrollToFrame(page, frame5)

  await frame5.click(`#quiz-option-card-checkbox`)
  await frame5.fill(`label:has-text("Title") input:below(h4:text("checkbox"))`, `Please check this`)

  await page.click(`[aria-label="Close"]`)
  // Click text=Add task
  await page.click("text=Add task")

  // Click [aria-label="Edit"] >> nth=5
  await page.locator('[aria-label="Edit"]').nth(5).click()

  // Click text=Quizzes
  await page.locator("text=Quizzes").click()

  const frame6 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )
  if (!frame6) {
    throw new Error("Frame6 not found")
  }
  await scrollToFrame(page, frame6)

  await frame6.click(`#quiz-option-card-matrix`)
  await frame6.fill(`tr:nth-child(1) td:nth-child(1) input`, "1")
  await frame6.fill(`tr:nth-child(1) td:nth-child(2) input`, "2")
  await frame6.fill(`tr:nth-child(2) td:nth-child(1) input`, "3")
  await frame6.fill(`tr:nth-child(2) td:nth-child(2) input`, "4")

  // rest quiz item types created on their own tasks
  // multiple choice dropdown
  await page.click(`[aria-label="Close"]`)
  await page.click(`text="Add task"`)
  await page.click(`:nth-match([aria-label="Edit"], 7)`)
  await page.click(`text="Quizzes"`)
  const frame7 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  if (!frame7) {
    throw new Error("Frame7 not found")
  }

  await scrollToFrame(page, frame7)

  await frame7.click(`#quiz-option-card-multiple-choice-dropdown`)
  await frame7.fill(`label:has-text("Title") input`, `Select correct option from dropdown`)
  await frame7.click(`button:text("Add option")`)
  await frame7.click(`button:text("Add option")`)
  await frame7.click(`[aria-label="Option 1"]`)
  await fillQuizItemOptionModal(page, frame7, {
    type: "multiple-choice",
    correct: false,
    title: `wrong`,
    messageAfterSubmissionWhenSelected: `no`,
  })
  await frame7.click(`[aria-label="Option 2"]`)
  await fillQuizItemOptionModal(page, frame7, {
    type: "multiple-choice",
    correct: true,
    title: `correct`,
    messageAfterSubmissionWhenSelected: `yes`,
  })

  // clickable multiple choice
  await page.click(`[aria-label="Close"]`)
  await page.click(`text="Add task"`)
  await page.click(`:nth-match([aria-label="Edit"], 8)`)
  await page.click(`text="Quizzes"`)
  const frame8 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  if (!frame8) {
    throw new Error("Frame8 not found")
  }

  await scrollToFrame(page, frame8)

  await frame8.click(`#quiz-option-card-clickable-multiple-choice`)
  await frame8.fill(`label:has-text("Title") input`, `Select correct option from dropdown`)
  await frame8.click(`button:text("Add option")`)
  await frame8.click(`button:text("Add option")`)
  await frame8.click(`[aria-label="Option 1"]`)
  await fillQuizItemOptionModal(page, frame8, {
    type: "multiple-choice",
    correct: false,
    title: `input`,
    messageAfterSubmissionWhenSelected: `no`,
  })
  await frame8.click(`[aria-label="Option 2"]`)

  await fillQuizItemOptionModal(page, frame8, {
    type: "multiple-choice",
    correct: true,
    title: `correct`,
    messageAfterSubmissionWhenSelected: `yes`,
  })

  // Click button:text-is("Save")
  await page.click(`button:text-is("Save") >> visible=true`)
})

async function scrollToFrame(page: Page, frame: Frame) {
  const frameElement = await frame.frameElement()
  const boundingBox = await frameElement.boundingBox()
  if (!boundingBox) {
    throw new Error("Frame had no bounding box")
  }
  const y = boundingBox.y
  await page.evaluate((y) => {
    window.scrollTo(0, window.scrollY + y)
  }, y)
}
