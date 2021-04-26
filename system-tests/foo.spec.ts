import { it, expect } from "@playwright/test"

it("is a basic test with the page", async ({ page, browser }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  // Click text=Introduction to everything
  await Promise.all([page.waitForNavigation(), page.click("text=Introduction to everything")])

  // Click text=Part 1 (/part-1)
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/part-1' }*/),
    page.click("text=Part 1 (/part-1)"),
  ])

  const screenshot = await page.screenshot()
  //expect(screenshot).toMatchSnapshot(`test.png`, { threshold: 0.2 })

  const secondContext = await browser.newContext()
  const secondPage = await secondContext.newPage()
  await secondPage.goto("http://project-331.local")
  await page.goBack()
  await Promise.all([
    secondPage.waitForNavigation(/*{ url: 'http://project-331.local/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec' }*/),
    secondPage.click("text=University of Helsinki, Department of Computer Science"),
  ])
  // Click text=Introduction to everything
  await Promise.all([
    secondPage.waitForNavigation(),
    secondPage.click("text=Introduction to everything"),
  ])
  await page.goForward()
})
