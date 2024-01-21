import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Limited tries work", async ({ page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage\\ course\\ \\'Limited\\ tries\\'\"] svg").click()

  await page.locator('a[role="tab"]:has-text("Pages")').click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/9da60c66-9517-46e4-b351-07d0f7aa6cd4/pages",
  )

  await page.locator("text=Page 6/chapter-1/page-6Edit page >> button").first().click()

  await page.locator('[placeholder="Max\\ points"]').click()
  // Fill [placeholder="Max\ points"]
  await page.locator('[placeholder="Max\\ points"]').fill("8")

  await page.locator("text=Limit number of tries").click()

  await page.locator('[placeholder="Max\\ tries\\ per\\ slide"]').click()
  // Fill [placeholder="Max\ tries\ per\ slide"]
  await page.locator('[placeholder="Max\\ tries\\ per\\ slide"]').fill("2")

  await page.locator(`button:text-is("Save")`).nth(1).click()

  await page.locator("text=Operation successful!").waitFor()

  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("text=Limited tries").click()

  await page.locator("text=Objective #1").waitFor({ state: "attached" })

  await selectCourseInstanceIfPrompted(page)

  await page.locator("text=Start course").click()

  await page.locator("text=The Basics").click()

  await page.locator("text=6Page 6").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/limited-tries/chapter-1/page-6",
  )

  // await page.locator("text=Points:0/8").waitFor()
  // await page.locator("div.points").getByText("0/8").waitFor()
  await Promise.all([
    page.waitForSelector('span.heading:has-text("POINTS")'),
    page.waitForSelector('div.points:has-text("0⁄8")')
  ]);

  // await page.locator("text=Tries remaining: 2").waitFor()
  await page.waitForSelector('div.tries:has-text("2")')


  await page.frameLocator("iframe").locator("text=AC").click()

  await page.frameLocator("iframe").locator("text=Jupiter").click()

  await page.locator("text=Submit").click()

  // await page.locator("text=Tries remaining: 1").click()
  await page.waitForSelector('div.tries:has-text("1")')


  await page.locator("text=try again").click()

  await page.frameLocator("iframe").locator("text=AC").click()
  await page.frameLocator("iframe").locator("text=Jupiter").click()

  await page.frameLocator("iframe").locator("text=Erlang").click()

  await page.frameLocator("iframe").locator("text=Jupiter").click()

  await page.locator("text=Submit").click()

  // await page.locator("text=Tries remaining: 0").waitFor()
  await page.waitForSelector('div.tries:has-text("0")')
  await page.locator("text=try again").waitFor({ state: "hidden" })
})
