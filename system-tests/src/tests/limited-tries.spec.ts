import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Limited tries work", async ({ page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  // Click [aria-label="Manage\ course\ \'Limited\ tries\'"] svg
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/9da60c66-9517-46e4-b351-07d0f7aa6cd4' }*/),
    page.locator("[aria-label=\"Manage\\ course\\ \\'Limited\\ tries\\'\"] svg").click(),
  ])
  // Click a[role="tab"]:has-text("Pages")
  await page.locator('a[role="tab"]:has-text("Pages")').click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/9da60c66-9517-46e4-b351-07d0f7aa6cd4/pages",
  )
  // Click text=Page 6/chapter-1/page-6Edit page >> button >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/989ee504-c938-4705-9cba-9272a31c5952' }*/),
    page.locator("text=Page 6/chapter-1/page-6Edit page >> button").first().click(),
  ])
  // Click [placeholder="Max\ points"]
  await page.locator('[placeholder="Max\\ points"]').click()
  // Fill [placeholder="Max\ points"]
  await page.locator('[placeholder="Max\\ points"]').fill("8")
  // Click text=Limit number of tries
  await page.locator("text=Limit number of tries").click()
  // Click [placeholder="Max\ tries\ per\ slide"]
  await page.locator('[placeholder="Max\\ tries\\ per\\ slide"]').click()
  // Fill [placeholder="Max\ tries\ per\ slide"]
  await page.locator('[placeholder="Max\\ tries\\ per\\ slide"]').fill("2")
  // Click button:text-is("Save") >> nth=1
  await page.locator(`button:text-is("Save")`).nth(1).click()
  // Click text=Operation successful!
  await page.locator("text=Operation successful!").waitFor()
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  // Click text=Limited tries
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/limited-tries' }*/),
    page.locator("text=Limited tries").click(),
  ])

  await page.locator("text=Objective #1").waitFor({ state: "attached" })

  await selectCourseInstanceIfPrompted(page)

  await page.locator("text=Start course").click()
  // Click text=The Basics
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/limited-tries/chapter-1' }*/),
    page.locator("text=The Basics").click(),
  ])
  // Click text=6Page 6
  await page.locator("text=6Page 6").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/limited-tries/chapter-1/page-6",
  )
  // Click text=Points:0/8
  await page.locator("text=Points:0/8").waitFor()
  // Click text=Tries remaining: 2
  await page.locator("text=Tries remaining: 2").waitFor()
  // Click text=AC
  await page.frameLocator("iframe").locator("text=AC").click()
  // Click text=Submit
  await page.locator("text=Submit").click()
  // Click text=Tries remaining: 1
  await page.locator("text=Tries remaining: 1").click()
  // Click text=try again
  await page.locator("text=try again").click()
  // Click text=Erlang
  await page.frameLocator("iframe").locator("text=Erlang").click()
  // Click text=Jupiter
  await page.frameLocator("iframe").locator("text=Jupiter").click()
  // Click text=Submit
  await page.locator("text=Submit").click()
  // Click text=Tries remaining: 0
  await page.locator("text=Tries remaining: 0").waitFor()
  await page.locator("text=try again").waitFor({ state: "hidden" })
})
