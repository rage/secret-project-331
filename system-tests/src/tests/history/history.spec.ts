import { expect, test } from "@playwright/test"

import expectPath from "../../utils/expect"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Introduction to Everything
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything' }*/),
    page.click("text=Introduction to Everything"),
  ])

  // Click text=default
  await page.click("text=default")
  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  // Click a:has-text("CHAPTER 1The Basics")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything/chapter-1' }*/),
    page.click('a:has-text("CHAPTER 1The Basics")'),
  ])

  // Click text=1Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything/chapter-1/page-1' }*/),
    page.click("text=1Page One"),
  ])
  await page.waitForLoadState("networkidle")

  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`initial-page.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Go to http://project-331.local/
  page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Manage
  await Promise.all([page.waitForNavigation(), await page.click("text=Manage")])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Manage pages")])
  expectPath(page, "/manage/courses/[id]/pages")

  // Click text=Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad' }*/),
    page.click("text=Page One"),
  ])

  // Triple click input[type="text"]
  await page.click('input[type="text"]', {
    clickCount: 3,
  })

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "New title!")

  // Click text=Save
  await page.click("text=Save")

  // Triple click [placeholder="Exercise name"]
  await page.click('[placeholder="Exercise name"]', {
    clickCount: 3,
  })

  // Fill [placeholder="Exercise name"]
  await page.fill('[placeholder="Exercise name"]', "New exercise!")

  // Click text=Save
  await page.click("text=Save")
  await page.waitForTimeout(100)

  // Click [placeholder="Option text"]
  await page
    .frame({
      url: "http://project-331.local/example-exercise/editor?width=780",
    })
    .click('[placeholder="Option text"]')
  // Press a with modifiers
  await page
    .frame({
      url: "http://project-331.local/example-exercise/editor?width=780",
    })
    .press('[placeholder="Option text"]', "Control+a")
  // Fill [placeholder="Option text"]
  await page
    .frame({
      url: "http://project-331.local/example-exercise/editor?width=780",
    })
    .fill('[placeholder="Option text"]', "Updated answer")
  // Check input[type="checkbox"]
  await page
    .frame({
      url: "http://project-331.local/example-exercise/editor?width=780",
    })
    .check('input[type="checkbox"]')

  // Click text=Save
  await page.click("text=Save")
  await page.waitForTimeout(100)

  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click("text=Home"),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await page.click("text=University of Helsinki, Department of Computer Science")
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Manage
  await Promise.all([page.waitForNavigation(), await page.click("text=Manage")])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), await page.click("text=Manage pages")])
  expectPath(page, "/manage/courses/[id]/pages")

  // Click text=New title!(/chapter-1/page-1) history >> :nth-match(a, 2)
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad/history' }*/),
    page.click("text=New title!(/chapter-1/page-1) history >> :nth-match(a, 2)"),
  ])

  await page.waitForSelector("text=core/paragraph")
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`history-view-p1.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Click [aria-label="Go to page 4"]
  await page.click('[aria-label="Go to page 4"]')
  expectPath(page, "/manage/pages/[id]/history?page=4")

  await page.waitForSelector("text=core/paragraph")
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`history-view-p4-before-compare.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }
  await page.waitForTimeout(100)

  // Click text=Compare
  await page.click("text=Compare")
  await page.waitForSelector("text=core/paragraph")

  // Click :nth-match(:text("["), 3)
  await page.click(':nth-match(:text("["), 3)')
  // Press PageDown
  await page.press(
    ':nth-match([aria-label="Editor content;Press Alt+F1 for Accessibility Options."], 2)',
    "PageDown",
  )
  // Press PageDown
  await page.press(
    ':nth-match([aria-label="Editor content;Press Alt+F1 for Accessibility Options."], 2)',
    "PageDown",
  )

  await page.waitForSelector("text=Best exercise")
  await page.waitForTimeout(100)
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`history-view-p4-after-compare.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Click text=Restore
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/pages/ebc1c42f-c61e-4f4b-89df-b31f3d227bad/history?page=1' }*/),
    page.click("text=Restore"),
  ])
  await page.click("text=Page edit history") // deselect restore
  await page.waitForSelector("[aria-label='page 1'][aria-current='true']")
  await page.waitForTimeout(100)

  await page.waitForSelector("text=Best exercise")
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`history-view-after-restore.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click("text=Home"),
  ])

  // Click text=University of Helsinki, Department of Computer Science
  await page.click("text=University of Helsinki, Department of Computer Science")
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Introduction to Everything
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything' }*/),
    page.click("text=Introduction to Everything"),
  ])

  // Click a:has-text("CHAPTER 1The Basics")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything/chapter-1' }*/),
    page.click('a:has-text("CHAPTER 1The Basics")'),
  ])

  // Click text=1New title!
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything/chapter-1/page-1' }*/),
    page.click("text=1New title!"),
  ])

  await page.waitForLoadState("networkidle")
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`page-after-restore.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }
})
