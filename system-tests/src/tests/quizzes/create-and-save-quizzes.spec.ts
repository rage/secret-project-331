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
    expectPath(page, "/organizations/[id]")

    // Click text=Add course
    await page.click("text=Add course")

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "quizzes test")

    // Click text=Create course
    await page.click("text=Create course")

    await Promise.all([
      page.waitForNavigation(),
      await page.click("text=quizzes test Manage >> :nth-match(a, 2)"),
    ])
    // Click :nth-match(:text("Manage"), 4)

    expectPath(page, "/manage/courses/[id]")

    // Click text=Manage pages
    await Promise.all([page.waitForNavigation(), page.click("text=Manage pages")])
    expectPath(page, "/manage/courses/[id]/pages")

    // Click text=Add new chapter
    await page.click("text=Add new chapter")

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first")

    // Click text=Create chapter
    await page.click("text=Create chapter")

    // Click :nth-match(:text("New page"), 2)
    await page.click(':nth-match(:text("New page"), 2)')

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first page")

    // Click text=Create page
    await page.click("text=Create page")

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

    // Click [aria-label="Add ExerciseTask"]
    await page.click('[aria-label="Add ExerciseTask"]')

    // Click text=Quizzes
    await page.click("text=Quizzes")

    const frame = await waitForFunction(page, () =>
      page.frames().find((f) => {
        return f.url().startsWith("http://project-331.local/quizzes/editor")
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

    // Click text=grant_whenever_possible
    await frame.click("text=grant_whenever_possible")

    await page.evaluate(() => window.scrollBy(0, 200))

    // Click text=grant_only_when_fully_complete
    await frame.click("text=grant_only_when_fully_complete")

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
    // Click text=minmin >> input[type="number"]
    await frame.click('text=minmin >> input[type="number"]')
    // Fill text=minmin >> input[type="number"]
    await frame.fill('text=minmin >> input[type="number"]', "01")
    // Click text=maxmax >> input[type="number"]
    await frame.click('text=maxmax >> input[type="number"]')
    // Fill text=maxmax >> input[type="number"]
    await frame.fill('text=maxmax >> input[type="number"]', "07")
    // Click text=minmininvalid min value >> input[type="number"]
    await frame.click('text=minmininvalid min value >> input[type="number"]')
    // Fill text=minmininvalid min value >> input[type="number"]
    await frame.fill('text=minmininvalid min value >> input[type="number"]', "")
    // Click text=minmin >> input[type="number"]
    await frame.click('text=minmin >> input[type="number"]')
    // Fill text=minmin >> input[type="number"]
    await frame.fill('text=minmin >> input[type="number"]', "01")
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
    await frame.click('text=Validity regexValidity regex >> input[type="text"]')
    // Fill text=Validity regexValidity regex >> input[type="text"]
    await frame.fill('text=Validity regexValidity regex >> input[type="text"]', "[]")
    // Press ArrowLeft
    await frame.press('text=Validity regexValidity regex >> input[type="text"]', "ArrowLeft")
    // Fill text=Validity regexValidity regex >> input[type="text"]
    await frame.fill('text=Validity regexValidity regex >> input[type="text"]', "[0,9]")
    // Click text=Format regexFormat regex >> input[type="text"]
    await frame.click('text=Format regexFormat regex >> input[type="text"]')
    // Fill text=Format regexFormat regex >> input[type="text"]
    await frame.fill('text=Format regexFormat regex >> input[type="text"]', "*")

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

    expectPath(page, "/organizations/[id]")

    // Click text=Add course
    await page.click("text=Add course")

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "quizzes test, multiple choice")

    // Click text=Create course
    await page.click("text=Create course")

    // Click :nth-match(:text("Manage"), 4)
    await Promise.all([
      page.waitForNavigation(),
      await page.click("text=quizzes test, multiple choice Manage >> :nth-match(a, 2)"),
    ])
    expectPath(page, "/manage/courses/[id]")

    // Click text=Manage pages
    await Promise.all([page.waitForNavigation(), await page.click("text=Manage pages")])
    expectPath(page, "/manage/courses/[id]/pages")

    // Click text=Add new chapter
    await page.click("text=Add new chapter")

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first")

    // Click text=Create chapter
    await page.click("text=Create chapter")

    // Click :nth-match(:text("New page"), 2)
    await page.click(':nth-match(:text("New page"), 2)')

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "first page")

    // Click text=Create page
    await page.click("text=Create page")

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

    // Click [aria-label="Add ExerciseTask"]
    await page.click('[aria-label="Add ExerciseTask"]')

    // Click text=Quizzes
    await page.click("text=Quizzes")

    const frame = await waitForFunction(page, () =>
      page.frames().find((f) => {
        return f.url().startsWith("http://project-331.local/quizzes/editor")
      }),
    )

    // Click text=multiple-choice
    await frame.click("text=multiple-choice")

    // Click text=title *title * >> textarea
    await frame.click("text=title *title * >> textarea")

    // Fill text=title *title * >> textarea
    await frame.fill("text=title *title * >> textarea", "multiple choice test")

    // Click .sc-fcmMJX .MuiButton-root
    await frame.click("button[title='add option']")

    // Click .MuiButton-root.MuiButton-outlined
    await frame.click(`[aria-label="Option 1"]`)

    // Click text=Option title *Option title * >> textarea

    await page.evaluate(() => window.scrollTo(0, 800))
    await frame.click("text=Option title *Option title * >> textarea")

    // Fill text=Option title *Option title * >> textarea
    await frame.fill("text=Option title *Option title * >> textarea", "first")

    // Check text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> input[type="checkbox"]
    await frame.check(
      'text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> input[type="checkbox"]',
    )

    // Click text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button
    await frame.click(
      "text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button",
    )

    await page.waitForTimeout(100)

    // Click .sc-GvhzO div:nth-child(2) .MuiButton-root
    await frame.click("button[title='add option']")

    // Click .MuiButton-root.MuiButton-outlined.MuiButton-outlinedPrimary.MuiButton-sizeMedium.MuiButton-outlinedSizeMedium.MuiButtonBase-root.sc-hOPeYd
    await frame.click(`[aria-label="Option 2"]`)

    // Click text=Option title *Option title * >> textarea
    await page.evaluate(() => window.scrollTo(0, 800))
    await frame.click("text=Option title *Option title * >> textarea")

    // Fill text=Option title *Option title * >> textarea
    await frame.fill("text=Option title *Option title * >> textarea", "second")

    // Click text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button
    await frame.click(
      "text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button",
    )

    // Click text=Save
    await page.click("text=Save")
  })
})
