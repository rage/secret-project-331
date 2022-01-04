import { test } from "@playwright/test"

import expectPath from "../../utils/expect"
import waitForFunction from "../../utils/waitForFunction"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test.describe("quizzes tests", () => {
  test("test", async ({ page }) => {
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
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first")

    // Click text=Create chapter
    await page.click(`button:text("Create")`)

    // Click :nth-match(:text("New page"), 2)
    await page.click(`:nth-match(button:text("New"):below(:text("Chapter 1")), 1)`)

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first page")

    // Click text=Create
    await page.click(`button:text("Create")`)

    // Click text=first page
    await Promise.all([page.waitForNavigation(), page.click('a:has-text("first page")')])

    // Click :nth-match([aria-label="Add block"], 2)
    await page.click(':nth-match([aria-label="Add block"], 2)')

    // Click [placeholder="Search"]
    await page.click('[placeholder="Search"]')

    // Fill [placeholder="Search"]
    await page.fill('[placeholder="Search"]', "exercise")

    // Click button[role="option"]:has-text("Exercise")
    await page.click('button[role="option"]:has-text("Exercise")')

    // Click p[role="button"]
    await page.click('p[role="button"]')

    // Click [aria-label="Block: Exercise"] div:has-text("Exercise")
    await page.click('[aria-label="Block: Exercise"] div:has-text("Exercise​")')

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

    // Fill textarea
    await frame.fill("textarea", "testing quizzes")

    // Click input[type="number"]
    await frame.click('input[type="number"]')

    // Fill input[type="number"]
    await frame.fill('input[type="number"]', "01")

    // Click text=SectionSection >> input[type="number"]
    await frame.click('text=SectionSection >> input[type="number"]')

    // Fill text=SectionSection >> input[type="number"]
    await frame.fill('text=SectionSection >> input[type="number"]', "01")

    // Click text=Number of tries allowedNumber of tries allowed >> input[type="number"]
    await frame.click('text=Number of tries allowedNumber of tries allowed >> input[type="number"]')

    // Fill text=Number of tries allowedNumber of tries allowed >> input[type="number"]
    await frame.fill(
      'text=Number of tries allowedNumber of tries allowed >> input[type="number"]',
      "03",
    )

    // Click text=Points to gainPoints to gain >> input[type="number"]
    await frame.click('text=Points to gainPoints to gain >> input[type="number"]')

    // Fill text=Points to gainPoints to gain >> input[type="number"]
    await frame.fill('text=Points to gainPoints to gain >> input[type="number"]', "05")

    // Click text=Grant whenever possible
    await frame.click("text=Grant whenever possible")

    await page.evaluate(() => window.scrollBy(0, 200))

    // Click text=grant_only_when_fully_complete
    await frame.click("text=Grant only when fully correct")

    // Choose date button seems not to react clicks right away
    await page.waitForTimeout(100)
    await frame.click(`[aria-label^="Choose date, selected date is"]`)

    // Click text=10
    await frame.click("text=10")

    // Click [aria-label="open next view"]
    await frame.click('[aria-label="open next view"]')

    // Click .css-1i3at1m
    await frame.click(".css-1i3at1m")

    // Click text=Quiz description *Quiz description * >> textarea
    await frame.click("text=Quiz description *Quiz description * >> textarea")

    // Fill text=Quiz description *Quiz description * >> textarea
    await frame.fill("text=Quiz description *Quiz description * >> textarea", "quiz description")

    // Click text=Submit message *Submit message * >> textarea
    await frame.click("text=Submit message *Submit message * >> textarea")

    // Fill text=Submit message *Submit message * >> textarea
    await frame.fill("text=Submit message *Submit message * >> textarea", "message")

    // Click text=essay
    await frame.click("text=essay")

    // Click text=Description for this quiz item *Description for this quiz item * >> textarea
    await frame.click(
      "text=Description for this quiz item *Description for this quiz item * >> textarea",
    )

    // Fill text=Description for this quiz item *Description for this quiz item * >> textarea
    await frame.fill(
      "text=Description for this quiz item *Description for this quiz item * >> textarea",
      "essay quiz",
    )

    // Click text=Min wordsMin words >> input[type="number"]
    await frame.click('text=Min wordsMin words >> input[type="number"]')

    // Fill text=Min wordsMin words >> input[type="number"]
    await frame.fill('text=Min wordsMin words >> input[type="number"]', "100")

    // Click text=Max wordsMax words >> input[type="number"]
    await frame.click('text=Max wordsMax words >> input[type="number"]')

    // Fill text=Max wordsMax words >> input[type="number"]
    await frame.fill('text=Max wordsMax words >> input[type="number"]', "500")

    // Click text=scale
    await frame.click("text=scale")
    // Click text=Title *Title * >> textarea
    await frame.click("text=Title *Title * >> textarea")
    // Fill text=Title *Title * >> textarea
    await frame.fill("text=Title *Title * >> textarea", "scale test")
    // Click text=Minimum >> input[type="number"]
    await frame.click(`:nth-match(input[type="number"]:near(:text("Minimum")), 1)`)
    // Fill text=Minimum >> input[type="number"]
    await frame.fill(`:nth-match(input[type="number"]:near(:text("Maximum")), 1)`, "01")
    // Click text=Maximum >> input[type="number"]
    await frame.click(`:nth-match(input[type="number"]:near(:text("Maximum")), 1)`)
    // Fill text=Maximum >> input[type="number"]
    await frame.fill(`:nth-match(input[type="number"]:near(:text("Maximum")), 1)`, "07")
    // Click text=Minimuminvalid min value >> input[type="number"]
    await frame.click(`:nth-match(input[type="number"]:near(:text("Minimum")), 1)`)
    // Fill text=Minimuminvalid min value >> input[type="number"]
    await frame.fill(`:nth-match(input[type="number"]:near(:text("Minimum")), 1)`, "")
    // Click text=Minimum >> input[type="number"]
    await frame.click(`:nth-match(input[type="number"]:near(:text("Maximum")), 1)`)
    // Fill text=Minimum >> input[type="number"]
    await frame.fill(`:nth-match(input[type="number"]:near(:text("Maximum")), 1)`, "01")
    // Click text=open
    await frame.click("text=open")
    // Click text=Title *Title * >> textarea
    await frame.click("text=Title *Title * >> textarea")
    // Fill text=Title *Title * >> textarea
    await frame.fill("text=Title *Title * >> textarea", "open test")
    // Click text=Body *Body * >> textarea
    await frame.click("text=Body *Body * >> textarea")
    // Fill text=Body *Body * >> textarea
    await frame.fill("text=Body *Body * >> textarea", "open body")
    // Click text=Validity regexValidity regex >> input[type="text"]
    await frame.click(
      `:nth-match(input[type="text"]:near(:text("Validity regular expression")), 1)`,
    )
    // Fill text=Validity regexValidity regex >> input[type="text"]
    await frame.fill(
      `:nth-match(input[type="text"]:near(:text("Validity regular expression")), 1)`,
      "[]",
    )
    // Press ArrowLeft
    await frame.press(
      `:nth-match(input[type="text"]:near(:text("Validity regular expression")), 1)`,
      "ArrowLeft",
    )
    // Fill text=Validity regexValidity regex >> input[type="text"]
    await frame.fill(
      `:nth-match(input[type="text"]:near(:text("Validity regular expression")), 1)`,
      "[0,9]",
    )
    // Click text=Format regexFormat regex >> input[type="text"]
    await frame.click(
      `:nth-match(input[type="text"]:near(:text("Validity regular expression")), 1)`,
    )
    // Fill text=Format regexFormat regex >> input[type="text"]
    await frame.fill(
      `:nth-match(input[type="text"]:near(:text("Format regular expression")), 1)`,
      "*",
    )

    // Click text=Save
    await page.click("text=Save")
  })

  test("multiple choice", async ({ page }) => {
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
    await page.fill('input[type="text"]', "quizzes test, multiple choice")

    await page.fill('input[id="teacher-in-charge-name"]', "teacher")
    await page.fill('input[id="teacher-in-charge-email"]', "teacher@example.com")

    // Click text=Create course
    await page.click(`button:text("Create"):below(:text("Course language"))`)

    // Click :nth-match(:text("Manage"), 4)
    await Promise.all([
      page.waitForNavigation(),
      await page.click("[aria-label=\"Manage course 'quizzes test, multiple choice'\"] svg"),
    ])
    expectPath(page, "/manage/courses/[id]")

    // Click text=Manage pages
    await Promise.all([page.waitForNavigation(), await page.click("text=Manage pages")])
    expectPath(page, "/manage/courses/[id]/pages")

    // Click text=Add new chapter
    await page.click(`:nth-match(button:has-text("New"):below(:text("Chapters")), 1)`)

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first")

    // Click text=Create chapter
    await page.click(`button:text("Create")`)

    // Click :nth-match(:text("New page"), 2)
    await page.click(`:nth-match(button:text("New"):below(:text("Chapter 1")), 1)`)

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first page")

    // Click text=Create
    await page.click(`button:text("Create")`)

    // Click text=first page
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/83f0bdc1-6c18-42d7-b6b5-5c540dc2ba82' }*/),
      page.click("text=first page"),
    ])

    // Click :nth-match([aria-label="Add block"], 2)
    await page.click(':nth-match([aria-label="Add block"], 2)')

    // Click [placeholder="Search"]
    await page.click('[placeholder="Search"]')

    // Fill [placeholder="Search"]
    await page.fill('[placeholder="Search"]', "exercise")

    // Click button[role="option"]:has-text("Exercise")
    await page.click('button[role="option"]:has-text("Exercise")')

    // Click p[role="button"]
    await page.click('p[role="button"]')

    // Click [aria-label="Block: Exercise"] div:has-text("Exercise")
    await page.click('[aria-label="Block: Exercise"] div:has-text("Exercise​")')

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

    // Click text=multiple-choice
    await frame.click("text=multiple-choice")

    // Click text=title *title * >> textarea
    await frame.click("text=title *title * >> textarea")

    // Fill text=title *title * >> textarea
    await frame.fill("text=title *title * >> textarea", "multiple choice test")

    // Click .sc-fcmMJX .MuiButton-root
    await frame.click("button[title='Add option']")

    // Click .MuiButton-root.MuiButton-outlined
    await frame.click(`[aria-label="Option 1"]`)

    // Click text=Option title *Option title * >> textarea

    await page.evaluate(() => window.scrollTo(0, 800))
    await frame.click("text=Option title *Option title * >> textarea")

    // Fill text=Option title *Option title * >> textarea
    await frame.fill("text=Option title *Option title * >> textarea", "first")

    // Check text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> input[type="checkbox"]
    await frame.check(`input[type="checkbox"]:right-of(:text("Correct"))`)

    // Click text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button
    await frame.click(`button:right-of(:text("Editing option"))`)

    await page.waitForTimeout(100)

    // Click .sc-GvhzO div:nth-child(2) .MuiButton-root
    await frame.click("button[title='Add option']")

    // Click .MuiButton-root.MuiButton-outlined.MuiButton-outlinedPrimary.MuiButton-sizeMedium.MuiButton-outlinedSizeMedium.MuiButtonBase-root.sc-hOPeYd
    await frame.click(`[aria-label="Option 2"]`)

    // Click text=Option title *Option title * >> textarea
    await page.evaluate(() => window.scrollTo(0, 800))
    await frame.click("text=Option title *Option title * >> textarea")

    // Fill text=Option title *Option title * >> textarea
    await frame.fill("text=Option title *Option title * >> textarea", "second")

    // Click text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button
    await frame.click(`:nth-match(button:right-of(:text("Editing option")), 1)`)

    // Click text=Save
    await page.click("text=Save")
  })
})
