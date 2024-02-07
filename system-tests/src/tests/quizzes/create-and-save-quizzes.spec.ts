import { Locator, Page, test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../../utils/expect"
import {
  getLocatorForNthExerciseServiceIframe,
  scrollElementInsideIframeToView,
} from "../../utils/iframeLocators"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const createPageAndNavigate = async (page: Page) => {
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

  await page.getByText("Operation successful!").waitFor()

  await page.click(`a[aria-label="Manage course 'exercise test'"]`)

  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  await page.locator("text=Pages").click()
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")

  await page.click(`:nth-match(button:has-text("New chapter"), 1)`)

  // await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill(`label:has-text("Name")`, "first")

  await page.click(`button:text("Create")`)

  await page.getByText(`Chapter 1`).waitFor()

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
}

const addNewQuizz = async (page: Page) => {
  await page.locator("text=Add task").click()
  const count = await page.locator('[aria-label="Edit"]').count()
  // Sometimes the add task button doesn't respond due to lag
  if (count == 0) {
    await page.locator("text=Add task").click()
  }
  await page.locator('[aria-label="Edit"]').nth(0).click()
  await page.locator("text=Quizzes").click()
}

const createMultipleChoice = async (frame: Locator) => {
  /* NOP */
  await frame
    .getByRole("button", { name: "Multiple choice Choose correct answer from list of options" })
    .click()
  await frame.getByLabel("Title", { exact: true }).click()
  await frame.getByLabel("Title", { exact: true }).fill("multiple-choice-exercise")
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("option 1")

  await frame.getByLabel("Correct").check()
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("option 2")
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("option 3")
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Layout options Choose the direction the quiz item options will ",
    })
    .locator("summary")
    .click()

  await scrollElementInsideIframeToView(frame.getByLabel("Shuffle options"))
  await frame.getByLabel("Shuffle options").check()
  await frame.getByLabel("Shuffle options").uncheck()
  await frame.getByLabel("Shuffle options").check()
  await frame.getByLabel("Multiple options", { exact: true }).check()
  await frame.getByLabel("Fog of war").check()
  await frame.getByLabel("Fog of war").uncheck()
  await frame.getByLabel("Fog of war").check()

  await scrollElementInsideIframeToView(
    frame.getByRole("combobox", { name: "Multiple options grading policy" }),
  )
  await frame
    .getByRole("combobox", { name: "Multiple options grading policy" })
    .selectOption("points-off-incorrect-options")
  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Layout options Choose the direction the quiz item options will ",
    })
    .getByLabel("Success message", { exact: true })
    .click()
  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Layout options Choose the direction the quiz item options will ",
    })
    .getByLabel("Success message", { exact: true })
    .fill("Success message for feedback")
  await frame.getByLabel("Failure message", { exact: true }).click()
  await frame.getByLabel("Failure message", { exact: true }).fill("Failure message for feedback")
}

const createMultipleChoiceDropdown = async (frame: Locator) => {
  await frame
    .getByRole("button", {
      name: "Multiple choice with dropdown Choose correct option from dropdown menu",
    })
    .click()
  await frame.getByLabel("Title", { exact: true }).click()
  await frame.getByLabel("Title", { exact: true }).fill("multiple choice with dropdown")
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("option 1")
  await frame.getByLabel("Correct").check()
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("option 2")
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("option 3")
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Layout options Choose the direction the quiz item options will ",
    })
    .locator("summary")
    .click()

  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Layout options Choose the direction the quiz item options will ",
    })
    .getByLabel("Success message", { exact: true })
    .click()
  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Layout options Choose the direction the quiz item options will ",
    })
    .getByLabel("Success message", { exact: true })
    .fill("success message for feedback")
  await frame.getByLabel("Failure message", { exact: true }).click()
  await frame.getByLabel("Failure message", { exact: true }).fill("failure message for feedback")
}

const createChooseN = async (frame: Locator) => {
  await frame
    .getByRole("button", { name: "Select n Choose correct answer from list of options" })
    .click()
  await frame.getByLabel("Title", { exact: true }).click()
  await frame.getByLabel("Title", { exact: true }).fill("Choose N")
  await frame.getByLabel("Choices (N)", { exact: true }).click()
  await frame.getByLabel("Choices (N)", { exact: true }).fill("5")
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("Option 1")
  await frame.getByLabel("Correct").check()
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("Option 2")
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("Option 3")
  await frame.getByLabel("Correct").check()
  await frame.getByRole("button", { name: "Add option" }).click()
  await frame.getByLabel("Choices (N)", { exact: true }).click()
  await frame.getByLabel("Choices (N)", { exact: true }).fill("2")
  await frame
    .getByRole("group")
    .filter({ hasText: "Advanced options Feedback message Success message Failure message" })
    .locator("summary")
    .click()
  await frame
    .getByRole("group")
    .filter({ hasText: "Advanced options Feedback message Success message Failure message" })
    .getByLabel("Success message", { exact: true })
    .click()
  await frame
    .getByRole("group")
    .filter({ hasText: "Advanced options Feedback message Success message Failure message" })
    .getByLabel("Success message", { exact: true })
    .fill("Success message for feedback")
  await frame.getByLabel("Failure message", { exact: true }).click()
  await frame.getByLabel("Failure message", { exact: true }).fill("Failure message for feedback")
}

const createEssay = async (frame: Locator) => {
  await frame.getByRole("button", { name: "Essay For writing essays or just some text" }).click()
  await frame.getByLabel("Min words", { exact: true }).click()
  await frame.getByLabel("Min words", { exact: true }).press("ArrowLeft")
  await frame.getByLabel("Min words", { exact: true }).fill("100")
  await frame.getByLabel("Max words", { exact: true }).click()
  await frame.getByLabel("Max words", { exact: true }).fill("500")
}

const createClosedEndedQuestion = async (frame: Locator) => {
  await frame
    .getByRole("button", {
      name: "Closed-ended question Student writes a specific answer, validated with regex",
    })
    .click()
  await frame
    .getByRole("combobox", { name: "Format regular expression" })
    .selectOption("\\d{2}\\.\\d{2}\\.\\d{4}")
  await frame.getByLabel("Correct answer", { exact: true }).click()
  await frame.getByLabel("Correct answer", { exact: true }).fill("20.20.2020")
  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Test string .plus-circle_svg__cls-1{fill:none;stroke:currentCol",
    })
    .locator("summary")
    .click()
  await frame.getByLabel("Test string", { exact: true }).click()
  await frame.getByLabel("Test string", { exact: true }).fill("20.09.2010")
  await frame
    .getByRole("group")
    .filter({
      hasText: "Advanced options Test string .plus-circle_svg__cls-1{fill:none;stroke:currentCol",
    })
    .locator("button")
    .click()
  await frame.getByLabel("Test string").nth(3).click()
  await frame.getByLabel("Test string").nth(3).fill("20.20.2020")
  await frame.getByRole("combobox", { name: "Format regular expression" }).selectOption("\\d+")
  await frame
    .getByRole("combobox", { name: "Format regular expression" })
    .selectOption("\\d+\\,\\d+")
  await frame.getByRole("combobox", { name: "Format regular expression" }).selectOption("\\S+")
  await frame.getByLabel("Regex").check()
  await frame
    .getByText("Grading strategy Exact stringRegexValidity regular expression Format regular exp")
    .click()
  await frame.getByLabel("Format regular expression", { exact: true }).click()
  await frame.getByLabel("Format regular expression", { exact: true }).fill("\\d+")
  await frame.getByLabel("Validity regular expression", { exact: true }).fill("200")
}

const createScale = async (frame: Locator) => {
  await frame
    .getByRole("button", { name: "Scale Each question can be answer with number scale e.g. 1-5" })
    .click()
  await frame.getByLabel("Option title", { exact: true }).click()
  await frame.getByLabel("Option title", { exact: true }).fill("Option title for scale")
  await frame.getByLabel("Minimum", { exact: true }).click()
  await frame.getByLabel("Minimum", { exact: true }).fill("1")
  await frame.getByLabel("Maximum", { exact: true }).click()
  await frame.getByLabel("Maximum", { exact: true }).fill("10")
}

const createCheckbox = async (frame: Locator) => {
  await frame
    .getByRole("button", { name: "Checkbox Check boxes or not -- right or wrong answers" })
    .click()
  await frame.getByPlaceholder("Option title").click()
  await frame.getByPlaceholder("Option title").fill("Option title")
  await frame.getByLabel("", { exact: true }).check()
}

const createMatrix = async (frame: Locator) => {
  await frame
    .getByRole("button", { name: "Matrix Assignment to write answer in the form of a matrix" })
    .click()
  await frame.locator(".css-aklx7n-CellInputContainer").click()
  await frame.locator(".css-aklx7n-CellInputContainer").fill("1")
  await frame.locator(".css-864jm6-CellInputContainer").first().click()
  await frame.locator(".css-3jjv4o-CellInputContainer").fill("0")
  await frame.locator(".css-864jm6-CellInputContainer").first().click()
  await frame.locator(".css-3jjv4o-CellInputContainer").fill("0")
  await frame
    .locator("tr:nth-child(2) > td > .css-v1bss2 > .css-864jm6-CellInputContainer")
    .first()
    .click()
  await frame.locator(".css-3jjv4o-CellInputContainer").fill("0")
  await frame
    .locator("tr:nth-child(2) > td:nth-child(2) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .click()
  await frame
    .locator("tr:nth-child(2) > td:nth-child(2) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .fill("1")
  await frame
    .locator("tr:nth-child(2) > td:nth-child(3) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .click()
  await frame
    .locator("tr:nth-child(2) > td:nth-child(3) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .fill("0")
  await frame
    .locator("tr:nth-child(3) > td > .css-v1bss2 > .css-864jm6-CellInputContainer")
    .first()
    .click()
  await frame.locator(".css-3jjv4o-CellInputContainer").fill("0")
  await frame
    .locator("tr:nth-child(3) > td:nth-child(2) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .click()
  await frame
    .locator("tr:nth-child(3) > td:nth-child(2) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .fill("0")
  await frame
    .locator("tr:nth-child(3) > td:nth-child(3) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .click()
  await frame
    .locator("tr:nth-child(3) > td:nth-child(3) > .css-v1bss2 > .css-aklx7n-CellInputContainer")
    .fill("1")
}

const createTimeline = async (frame: Locator) => {
  await frame.getByRole("button", { name: "Timeline Match years to events on a timeline" }).click()
  await frame.getByPlaceholder("1994").click()
  await frame.getByPlaceholder("1994").fill("100")
  await frame.getByPlaceholder("Some notable event").click()
  await frame.getByPlaceholder("Some notable event").fill("event 1")
  await frame.getByRole("button", { name: "Add" }).click()
  await frame.getByPlaceholder("1994").click()
  await frame.getByPlaceholder("1994").fill("200")
  await frame.getByPlaceholder("Some notable event").click()
  await frame.getByPlaceholder("Some notable event").fill("event 2")
  await frame.getByRole("button", { name: "Add" }).click()
  await frame.getByPlaceholder("1994").click()
  await frame.getByPlaceholder("1994").fill("300")
  await frame.getByPlaceholder("Some notable event").click()
  await frame.getByPlaceholder("Some notable event").fill("not real event")
  await frame.getByRole("button", { name: "Add" }).click()
  await frame.getByPlaceholder("1994").click()
  await frame.getByPlaceholder("1994").fill("5000")
  await frame.getByPlaceholder("Some notable event").click()
  await frame.getByPlaceholder("Some notable event").fill("event 3")
  await frame.getByRole("button", { name: "Add" }).click()
  await frame.getByLabel("Delete").nth(1).click()
}

test("Create quizzes in page", async ({ page }) => {
  // Create page to course and navigate into the page
  await createPageAndNavigate(page)
  // ---------------------------------------------- //
  /// Multiple choice exercises

  // > Multiple choice
  await addNewQuizz(page)
  const multipleChoiceIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await scrollToFrame(page, multipleChoiceIframe)
  await createMultipleChoice(multipleChoiceIframe)

  // > Multiple choice dropdown
  await addNewQuizz(page)
  const multipleChoiceDropdownIframe = await getLocatorForNthExerciseServiceIframe(
    page,
    "quizzes",
    2,
  )
  await scrollToFrame(page, multipleChoiceDropdownIframe)
  await createMultipleChoiceDropdown(multipleChoiceDropdownIframe)

  // > Choose N
  await addNewQuizz(page)
  const chooseNIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 3)
  await scrollToFrame(page, chooseNIframe)
  await createChooseN(chooseNIframe)

  /// Input based exercises
  // > Essay
  await addNewQuizz(page)
  const essayIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 4)
  await scrollToFrame(page, essayIframe)
  await createEssay(essayIframe)

  // > Closed ended question
  await addNewQuizz(page)
  const closedEndedQuestionIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 5)
  await scrollToFrame(page, closedEndedQuestionIframe)
  await createClosedEndedQuestion(closedEndedQuestionIframe)

  /// Specialized exercises
  // > Scale
  await addNewQuizz(page)
  const scaleIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 6)
  await scrollToFrame(page, scaleIframe)
  await createScale(scaleIframe)

  // > Checkbox
  await addNewQuizz(page)
  const checkboxIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 7)
  await scrollToFrame(page, checkboxIframe)
  await createCheckbox(checkboxIframe)

  // > Matrix
  await addNewQuizz(page)
  const matrixIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 8)
  await scrollToFrame(page, matrixIframe)
  await createMatrix(matrixIframe)

  // > Timeline
  await addNewQuizz(page)
  const timelineIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 9)
  await scrollToFrame(page, timelineIframe)
  await createTimeline(timelineIframe)

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
