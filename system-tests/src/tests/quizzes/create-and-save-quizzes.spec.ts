import { Locator, Page, test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../../utils/expect"
import { getLocatorForNthExerciseServiceIframe } from "../../utils/iframeLocators"
import { closeModal, fillQuizItemOptionModal } from "../../utils/quizzesActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("create quizzes test", async ({ page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    await page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  await page.click(`button:text("Create")`)

  await page.click('input[type="radio"]')

  // Fill input[type="text"]
  await page.fill("text=Name", "exercise test")

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  await page.click(`button:text("Create"):below(:text("Course language"))`)

  await page.waitForSelector("text=Operation successful!")

  await page.click(`a[aria-label="Manage course 'exercise test'"]`)

  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  await page.locator("text=Pages").click()
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")

  await page.click(`:nth-match(button:has-text("New chapter"), 1)`)

  // await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill(`label:has-text("Name")`, "first")

  await page.click(`button:text("Create")`)

  await page.waitForSelector(`text=Chapter 1`)

  await page.click(`:nth-match(button:text("New page"):below(:text("Chapter 1")), 1)`)

  // await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill(`label:has-text("Title")`, "first page")

  await page.click(`button:text("Create")`)

  await page.click(`button:text("Edit page"):right-of(:text("first page"))`)

  await page.click(':nth-match([aria-label="Add block"], 1)')

  await page.click('[placeholder="Search"]')

  // Fill [placeholder="Search"]
  await page.fill('[placeholder="Search"]', "exercise")

  await page.click('button[role="option"]:has-text("Exercise")')

  await page.click('[aria-label="Block: Exercise"]')

  await page.click('[placeholder="Exercise name"]')

  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "quizzes test")

  await page.locator("text=Add slide").click()

  // The block needs to be focused for the button to work
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  await page.locator("text=Slide 1").click()

  await page.locator("text=Add task").click()

  await page.click('[aria-label="Block: ExerciseTask"] div[role="button"]')

  await page.locator("text=Quizzes").click()

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await frame.locator(`#quiz-option-card-essay`).click()
  await frame.locator(`label:has-text("Min words") input`).fill("100")
  await frame.locator(`label:has-text("Max words") input`).fill("500")

  await page.click(`[aria-label="Close"]`)

  await page.locator("text=Add task").click()

  await page.locator('[aria-label="Edit"]').nth(1).click()

  await page.locator("text=Quizzes").click()

  const frame2 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await scrollToFrame(page, frame2)

  await frame2.locator(`#quiz-option-card-scale`).click()
  await frame2.locator(`label:has-text("Title") input`).fill("Answer this question 1-6")
  await frame2.locator(`label:has-text("Minimum") input`).fill("1")
  await frame2.locator(`label:has-text("Maximum") input`).fill("6")

  await page.click(`[aria-label="Close"]`)

  await page.locator("text=Add task").click()

  await page.locator('[aria-label="Edit"]').nth(2).click()

  await page.locator("text=Quizzes").click()

  const frame3 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await scrollToFrame(page, frame3)

  await frame3.locator(`#quiz-option-card-open`).click()
  await frame3.locator(`label:has-text("Validity regular expression") input`).fill(`1\\/2`)
  await frame3.locator(`label:has-text("Format regular expression") input`).fill(`\\d+\\/\\d+`)
  await frame3
    .locator(
      `:nth-match(button:text("Test"):right-of(label:has-text("Format regular expression")), 1)`,
    )
    .click()
  await frame3.locator(`label:has-text("Test") input`).fill(`5`)
  await frame3.locator(`text="Given text does not match regular expression"`).waitFor()
  await frame3.locator(`label:has-text("Test") input`).fill(`1/2`)
  await frame3.locator(`text="Given text matches regular expression"`).waitFor()
  await closeModal(page, frame3)

  await page.click(`[aria-label="Close"]`)

  await page.locator("text=Add task").click()

  await page.locator('[aria-label="Edit"]').nth(3).click()

  await page.locator("text=Quizzes").click()

  const frame4 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await scrollToFrame(page, frame4)

  await frame4.locator(`#quiz-option-card-multiple-choice`).click()
  await frame4.locator(`label:has-text("Title") input`).fill(`What is the answer to this question?`)
  await frame4.locator(`button:text("Add option")`).click()
  await frame4.locator(`button:text("Add option")`).click()
  await frame4.locator(`[aria-label="Option 1"]`).click()
  await fillQuizItemOptionModal(page, frame4, {
    type: "multiple-choice",
    correct: false,
    title: `wrong`,
    messageAfterSubmissionWhenSelected: `no`,
  })
  await frame4.locator(`[aria-label="Option 2"]`).click()
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

  await page.locator("text=Add task").click()

  await page.locator('[aria-label="Edit"]').nth(4).click()

  await page.locator("text=Quizzes").click()

  const frame5 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await scrollToFrame(page, frame5)

  await frame5.locator(`#quiz-option-card-checkbox`).click()
  await frame5
    .locator(`label:has-text("Title") input:below(h4:text("checkbox"))`)
    .fill(`Please check this`)

  await page.click(`[aria-label="Close"]`)

  await page.locator("text=Add task").click()

  await page.locator('[aria-label="Edit"]').nth(5).click()

  await page.locator("text=Quizzes").click()

  const frame6 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await scrollToFrame(page, frame6)

  await frame6.locator(`#quiz-option-card-matrix`).click()
  await frame6.locator(`tr:nth-child(1) td:nth-child(1) input`).fill("1")
  await frame6.locator(`tr:nth-child(1) td:nth-child(2) input`).fill("2")
  await frame6.locator(`tr:nth-child(2) td:nth-child(1) input`).fill("3")
  await frame6.locator(`tr:nth-child(2) td:nth-child(2) input`).fill("4")

  // rest quiz item types created on their own tasks
  // multiple choice dropdown
  await page.click(`[aria-label="Close"]`)
  await page.click(`text="Add task"`)
  await page.click(`:nth-match([aria-label="Edit"], 7)`)
  await page.click(`text="Quizzes"`)
  const frame7 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await scrollToFrame(page, frame7)

  await frame7.locator(`#quiz-option-card-multiple-choice-dropdown`).click()
  await frame7.locator(`label:has-text("Title") input`).fill(`Select correct option from dropdown`)
  await frame7.locator(`button:text("Add option")`).click()
  await frame7.locator(`button:text("Add option")`).click()
  await frame7.locator(`[aria-label="Option 1"]`).click()
  await fillQuizItemOptionModal(page, frame7, {
    type: "multiple-choice",
    correct: false,
    title: `wrong`,
    messageAfterSubmissionWhenSelected: `no`,
  })
  await frame7.locator(`[aria-label="Option 2"]`).click()
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
  const frame8 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await scrollToFrame(page, frame8)

  await frame8.locator(`#quiz-option-card-clickable-multiple-choice`).click()
  await frame8.locator(`label:has-text("Title") input`).fill(`Select correct option from dropdown`)
  await frame8.locator(`button:text("Add option")`).click()
  await frame8.locator(`button:text("Add option")`).click()
  await frame8.locator(`[aria-label="Option 1"]`).click()
  await fillQuizItemOptionModal(page, frame8, {
    type: "multiple-choice",
    correct: false,
    title: `input`,
    messageAfterSubmissionWhenSelected: `no`,
  })
  await frame8.locator(`[aria-label="Option 2"]`).click()

  await fillQuizItemOptionModal(page, frame8, {
    type: "multiple-choice",
    correct: true,
    title: `correct`,
    messageAfterSubmissionWhenSelected: `yes`,
  })

  await page.click(`button:text-is("Save") >> visible=true`)
})

async function scrollToFrame(page: Page, locator: Locator) {
  const elementHandle = await locator.elementHandle()
  if (!elementHandle) {
    throw new Error("Cannot find frame")
  }
  const boundingBox = await elementHandle.boundingBox()
  if (!boundingBox) {
    throw new Error("Frame had no bounding box")
  }
  const y = boundingBox.y
  await page.evaluate((y) => {
    window.scrollTo(0, window.scrollY + y)
  }, y)
}
