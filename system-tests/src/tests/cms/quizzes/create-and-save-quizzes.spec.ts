import { expect, test } from "@playwright/test"

import expectPath from "../../../utils/expect"

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
      await page.click(':nth-match(:text("Manage"), 4)'),
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

    // Fill textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("textarea", "testing quizzes")

    // Click input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('input[type="number"]')

    // Fill input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('input[type="number"]', "01")

    // Click text=SectionSection >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=SectionSection >> input[type="number"]')

    // Fill text=SectionSection >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=SectionSection >> input[type="number"]', "01")

    // Click text=Number of tries allowedNumber of tries allowed >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=Number of tries allowedNumber of tries allowed >> input[type="number"]')

    // Fill text=Number of tries allowedNumber of tries allowed >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=Number of tries allowedNumber of tries allowed >> input[type="number"]', "03")

    // Click text=Points to gainPoints to gain >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=Points to gainPoints to gain >> input[type="number"]')

    // Fill text=Points to gainPoints to gain >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=Points to gainPoints to gain >> input[type="number"]', "05")

    // Click text=grant_whenever_possible
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=grant_whenever_possible")

    // Click text=grant_only_when_fully_complete
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=grant_only_when_fully_complete")

    // Click [aria-label="Choose date, selected date is Aug 9, 2021"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('[aria-label="Choose date, selected date is Aug 9, 2021"]')

    // Click text=10
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=10")

    // Click [aria-label="open next view"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('[aria-label="open next view"]')

    // Click .css-1i3at1m
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click(".css-1i3at1m")

    // Click text=Quiz description *Quiz description * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Quiz description *Quiz description * >> textarea")

    // Fill text=Quiz description *Quiz description * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=Quiz description *Quiz description * >> textarea", "quiz description")

    // Click text=Submit message *Submit message * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Submit message *Submit message * >> textarea")

    // Fill text=Submit message *Submit message * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=Submit message *Submit message * >> textarea", "message")

    // Click text=essay
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=essay")

    // Click text=Description for this quiz item *Description for this quiz item * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Description for this quiz item *Description for this quiz item * >> textarea")

    // Fill text=Description for this quiz item *Description for this quiz item * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill(
        "text=Description for this quiz item *Description for this quiz item * >> textarea",
        "essay quiz",
      )

    // Click text=Min wordsMin words >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=Min wordsMin words >> input[type="number"]')

    // Fill text=Min wordsMin words >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=Min wordsMin words >> input[type="number"]', "100")

    // Click text=Max wordsMax words >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=Max wordsMax words >> input[type="number"]')

    // Fill text=Max wordsMax words >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=Max wordsMax words >> input[type="number"]', "500")

    // Click text=scale
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=scale")
    // Click text=Title *Title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Title *Title * >> textarea")
    // Fill text=Title *Title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=Title *Title * >> textarea", "scale test")
    // Click text=minmin >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=minmin >> input[type="number"]')
    // Fill text=minmin >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=minmin >> input[type="number"]', "01")
    // Click text=maxmax >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=maxmax >> input[type="number"]')
    // Fill text=maxmax >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=maxmax >> input[type="number"]', "07")
    // Click text=minmininvalid min value >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=minmininvalid min value >> input[type="number"]')
    // Fill text=minmininvalid min value >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=minmininvalid min value >> input[type="number"]', "")
    // Click text=minmin >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=minmin >> input[type="number"]')
    // Fill text=minmin >> input[type="number"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=minmin >> input[type="number"]', "01")
    // Click text=open
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=open")
    // Click text=Title *Title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Title *Title * >> textarea")
    // Fill text=Title *Title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=Title *Title * >> textarea", "open test")
    // Click text=Body *Body * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Body *Body * >> textarea")
    // Fill text=Body *Body * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=Body *Body * >> textarea", "open body")
    // Click text=Validity regexValidity regex >> input[type="text"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=Validity regexValidity regex >> input[type="text"]')
    // Fill text=Validity regexValidity regex >> input[type="text"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=Validity regexValidity regex >> input[type="text"]', "[]")
    // Press ArrowLeft
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .press('text=Validity regexValidity regex >> input[type="text"]', "ArrowLeft")
    // Fill text=Validity regexValidity regex >> input[type="text"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=Validity regexValidity regex >> input[type="text"]', "[0,9]")
    // Click text=Format regexFormat regex >> input[type="text"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click('text=Format regexFormat regex >> input[type="text"]')
    // Fill text=Format regexFormat regex >> input[type="text"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill('text=Format regexFormat regex >> input[type="text"]', "*")

    // Click text=Save
    await page.click("text=Save")
  })

  test("multiple choice", async ({ page }) => {
    // Go to http://project-331.local/
    await page.goto("http://project-331.local/")

    // Click text=University of Helsinki, Department of Computer Science
    await page.click("text=University of Helsinki, Department of Computer Science")
    expect(page.url()).toBe(
      "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
    )

    // Click text=Add course
    await page.click("text=Add course")

    // Click input[type="text"]
    await page.click('input[type="text"]')

    // Fill input[type="text"]
    await page.fill('input[type="text"]', "quizzes test, multiple choice")

    // Click text=Create course
    await page.click("text=Create course")

    // Click :nth-match(:text("Manage"), 4)
    await page.click(':nth-match(:text("Manage"), 5)')
    expectPath(page, "/manage/courses/[id]")

    // Click text=Manage pages
    await page.click("text=Manage pages")
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

    // Click text=multiple-choice
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=multiple-choice")

    // Click text=title *title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=title *title * >> textarea")

    // Fill text=title *title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=title *title * >> textarea", "multiple choice test")

    // Click .sc-fcmMJX .MuiButton-root
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click(".sc-fcmMJX .MuiButton-root")

    // Click .MuiButton-root.MuiButton-outlined
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click(".MuiButton-root.MuiButton-outlined")

    // Click text=Option title *Option title * >> textarea

    await page.evaluate(() => window.scrollTo(0, 800))
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Option title *Option title * >> textarea")

    // Fill text=Option title *Option title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=Option title *Option title * >> textarea", "first")

    // Check text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> input[type="checkbox"]
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .check(
        'text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> input[type="checkbox"]',
      )

    // Click text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click(
        "text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button",
      )

    // Click .sc-GvhzO div:nth-child(2) .MuiButton-root
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click(".sc-GvhzO div:nth-child(2) .MuiButton-root")

    // Click .MuiButton-root.MuiButton-outlined.MuiButton-outlinedPrimary.MuiButton-sizeMedium.MuiButton-outlinedSizeMedium.MuiButtonBase-root.sc-hOPeYd
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click(
        ".MuiButton-root.MuiButton-outlined.MuiButton-outlinedPrimary.MuiButton-sizeMedium.MuiButton-outlinedSizeMedium.MuiButtonBase-root.sc-hOPeYd",
      )

    // Click text=Option title *Option title * >> textarea
    await page.evaluate(() => window.scrollTo(0, 800))
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click("text=Option title *Option title * >> textarea")

    // Fill text=Option title *Option title * >> textarea
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .fill("text=Option title *Option title * >> textarea", "second")

    // Click text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button
    await page
      .frame({
        url: "http://project-331.local/quizzes/editor?width=780",
      })
      .click(
        "text=Editing OptionCorrectSourcePreviewThis is markdown editor. You can write your te >> button",
      )

    // Click text=Save
    await page.click("text=Save")
  })
})
