import { chromium, expect, Page, test } from "@playwright/test"

import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.describe("test ManualReviewEverything behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let page1: Page
  let page2: Page
  let page3: Page
  let page4: Page
  test.beforeAll(async () => {
    const browser = await chromium.launch()

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()
    const context4 = await browser.newContext()

    page1 = await context1.newPage()
    page2 = await context2.newPage()
    page3 = await context3.newPage()
    page4 = await context4.newPage()

    await logout(page1)
    await logout(page2)
    await logout(page3)
    await logout(page4)

    await login("teacher@example.com", "teacher", page1, true)
    await login("student1@example.com", "student.1", page2, true)
    await login("student2@example.com", "student.2", page3, true)
    await login("student3@example.com", "student.3", page4, true)
  })
  test("ManualReviewEverything > That gets a perfect score gets sent to manual review", async ({
    headless,
  }) => {
    // Go to http://project-331.local/
    await page1.goto("http://project-331.local/")
    // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
    await page1
      .locator(
        '[aria-label="University of Helsinki\\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
      )
      .first()
      .click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs")
    // Click text=Course ModulesSample course.
    await page1.locator("text=Course ModulesSample course.").click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs/courses/course-modules")
    // Check input[name="select-course-instance"] >> nth=0
    await page1.locator('input[name="select-course-instance"]').first().check()
    // Click button:has-text("Continue")
    await page1.locator('button:has-text("Continue")').click()
    // Click .css-1q12po3 >> nth=0
    await page1.locator(".css-1q12po3").first().click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/course-modules/chapter-1",
    )
    // Click text=Table of contents1Page One2Page 23Page 34Page 45Page 56Page 67The timeline8Multi
    await page1
      .locator(
        "text=Table of contents1Page One2Page 23Page 34Page 45Page 56Page 67The timeline8Multi",
      )
      .click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/course-modules/chapter-1/page-4",
    )
    // Click a[role="button"]
    await page1.locator('a[role="button"]').click()
    await expect(page1).toHaveURL("http://project-331.local/")
    // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
    await page1
      .locator(
        '[aria-label="University of Helsinki\\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
      )
      .first()
      .click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs")
    // Click text=Introduction to everythingSample course.
    await page1.locator("text=Introduction to everythingSample course.").click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything",
    )
    // Check input[name="select-course-instance"] >> nth=0
    await page1.locator('input[name="select-course-instance"]').first().check()
    // Click button:has-text("Continue")
    await page1.locator('button:has-text("Continue")').click()
    // Click text=The Basics
    await page1.locator("text=The Basics").click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
    )
    // Click text=Page One >> nth=0
    await page1.locator("text=Page One").first().click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    // Click text=c
    await page1.frameLocator("iframe").locator("text=c").click()
    // Click button:has-text("Submit")
    await page1.locator('button:has-text("Submit")').click()
    // Click text=Start peer review
    await page1.locator("text=Start peer review").click()
    // Click textarea
    await page1.locator("textarea").click()
    // Fill textarea
    await page1.locator("textarea").fill("yes")
    // Click button:has-text("Submit")
    await page1.locator('button:has-text("Submit")').click()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-peer-review",
      waitForThisToBeVisibleAndStable: `text="Answer from another student"`,
      page: page1,
      clearNotifications: true,
      beforeScreenshot: async () => {
        page1.locator('h3:has-text("Peer review")').scrollIntoViewIfNeeded()
      },
    })

    // Go to http://project-331.local/
    await page2.goto("http://project-331.local/")
    // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
    await page2
      .locator(
        '[aria-label="University of Helsinki\\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
      )
      .first()
      .click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs")
    // Click text=Course ModulesSample course.
    await page2.locator("text=Course ModulesSample course.").click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs/courses/course-modules")
    // Check input[name="select-course-instance"] >> nth=0
    await page2.locator('input[name="select-course-instance"]').first().check()
    // Click button:has-text("Continue")
    await page2.locator('button:has-text("Continue")').click()
    // Click .css-1q12po3 >> nth=0
    await page2.locator(".css-1q12po3").first().click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/course-modules/chapter-1",
    )

    // Click text=Table of contents1Page One2Page 23Page 34Page 45Page 56Page 67The timeline8Multi
    await page2
      .locator(
        "text=Table of contents1Page One2Page 23Page 34Page 45Page 56Page 67The timeline8Multi",
      )
      .click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/course-modules/chapter-1/page-4",
    )
    // Click a[role="button"]
    await page2.locator('a[role="button"]').click()
    await expect(page2).toHaveURL("http://project-331.local/")
    // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
    await page2
      .locator(
        '[aria-label="University of Helsinki\\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
      )
      .first()
      .click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs")
    // Click text=Introduction to everythingSample course.
    await page2.locator("text=Introduction to everythingSample course.").click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything",
    )
    // Check input[name="select-course-instance"] >> nth=0
    await page2.locator('input[name="select-course-instance"]').first().check()
    // Click button:has-text("Continue")
    await page2.locator('button:has-text("Continue")').click()
    // Click text=The Basics
    await page2.locator("text=The Basics").click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
    )
    // Click text=Page One >> nth=0
    await page2.locator("text=Page One").first().click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    // Click text=c
    await page2.frameLocator("iframe").locator("text=c").click()
    // Click button:has-text("Submit")
    await page2.locator('button:has-text("Submit")').click()
    // Click text=Start peer review
    await page2.locator("text=Start peer review").click()
    // Click textarea
    await page2.locator("textarea").click()
    // Fill textarea
    await page2.locator("textarea").fill("yes")
    // Click button:has-text("Submit")
    await page2.locator('button:has-text("Submit")').click()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-peer-review",
      waitForThisToBeVisibleAndStable: `text="Answer from another student"`,
      page: page2,
      clearNotifications: true,
      beforeScreenshot: async () => {
        page1.locator('h3:has-text("Peer review")').scrollIntoViewIfNeeded()
      },
    })

    // Go to http://project-331.local/
    await page3.goto("http://project-331.local/")
    // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
    await page3
      .locator(
        '[aria-label="University of Helsinki\\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
      )
      .first()
      .click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs")
    // Click text=Course ModulesSample course.
    await page3.locator("text=Course ModulesSample course.").click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs/courses/course-modules")
    // Check input[name="select-course-instance"] >> nth=0
    await page3.locator('input[name="select-course-instance"]').first().check()
    // Click button:has-text("Continue")
    await page3.locator('button:has-text("Continue")').click()
    // Click .css-1q12po3 >> nth=0
    await page3.locator(".css-1q12po3").first().click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/course-modules/chapter-1",
    )
    // Click text=Table of contents1Page One2Page 23Page 34Page 45Page 56Page 67The timeline8Multi
    await page3
      .locator(
        "text=Table of contents1Page One2Page 23Page 34Page 45Page 56Page 67The timeline8Multi",
      )
      .click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/course-modules/chapter-1/page-4",
    )
    // Click a[role="button"]
    await page3.locator('a[role="button"]').click()
    await expect(page3).toHaveURL("http://project-331.local/")
    // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
    await page3
      .locator(
        '[aria-label="University of Helsinki\\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
      )
      .first()
      .click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs")
    // Click text=Introduction to everythingSample course.
    await page3.locator("text=Introduction to everythingSample course.").click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything",
    )
    // Check input[name="select-course-instance"] >> nth=0
    await page3.locator('input[name="select-course-instance"]').first().check()
    // Click button:has-text("Continue")
    await page3.locator('button:has-text("Continue")').click()
    // Click text=The Basics
    await page3.locator("text=The Basics").click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
    )
    // Click text=Page One >> nth=0
    await page3.locator("text=Page One").first().click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    // Click text=c
    await page3.frameLocator("iframe").locator("text=c").click()
    // Click button:has-text("Submit")
    await page3.locator('button:has-text("Submit")').click()
    // Click text=Start peer review
    await page3.locator("text=Start peer review").click()
    // Click textarea
    await page3.locator("textarea").click()
    // Fill textarea
    await page3.locator("textarea").fill("yes")
    // Click button:has-text("Submit")
    await page3.locator('button:has-text("Submit")').click()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-3-peer-review",
      waitForThisToBeVisibleAndStable: `text="Answer from another student"`,
      page: page3,
      clearNotifications: true,
      beforeScreenshot: async () => {
        page1.locator('h3:has-text("Peer review")').scrollIntoViewIfNeeded()
      },
    })
  })

  test("ManualReviewEverything > That gets the worst score gets sent to manual review", async ({
    headless,
  }) => {
    console.log("hello")
  })
  test("ManualReviewEverything > When an answer goes to manual review, the student won't get the points straight away", async ({
    headless,
  }) => {
    console.log("hello")
  })
  test("ManualReviewEverything > When the teacher manually reviews an answer, the user gets the points after it", async ({
    headless,
  }) => {
    console.log("hello")
  })
  test("ManualReviewEverything > If user submits multiple submissions to an exercise, and the answer goes to manual review after that, the manual review ui shows those submissions as grouped instead of two separate entries", async ({
    headless,
  }) => {
    console.log("hello")
  })
})
