import { expect, test } from "@playwright/test"

import { feedbackTooltipClass } from "../../shared-module/styles/constants"
import expectPath from "../../utils/expect"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Introduction to Course Material
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-course-material' }*/),
    page.click("text=Introduction to Course Material"),
  ])

  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  // Click a:has-text("CHAPTER 1User Interface")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-course-material/chapter-1' }*/),
    page.click('a:has-text("CHAPTER 1User Interface")'),
  ])

  // Triple click text=In the industrial design field of human–computer interaction, a user interface i
  await page.click(
    "text=In the industrial design field of human–computer interaction, a user interface i",
    {
      clickCount: 3,
    },
  )

  // Feedback tooltip
  await page.waitForSelector(`.${feedbackTooltipClass}`)
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`feedback-tooltip.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Click :nth-match(:text("Give feedback"), 2)
  await page.click(':nth-match(:text("Give feedback"), 2)')

  // Click textarea
  await page.click("textarea")

  // Fill textarea
  await page.fill(
    "textarea",
    "I found this pretty confusing! First of all, at vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.",
  )

  // Feedback input box
  // wait for fade-in
  await page.waitForTimeout(200)
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`feedback-input.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Click text=Submit
  await page.click('text="Submit"')
  await page.waitForSelector("text=Feedback submitted successfully")

  await logout(page)
  await login("admin@example.com", "admin", page, true)

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expectPath(page, "/organizations/[id]")

  // Click text=Introduction to Course Material Manage >> :nth-match(a, 2)
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=Introduction to Course Material Manage >> :nth-match(a, 2)"),
  ])
  expectPath(page, "/manage/courses/[id]")

  // Click text=Manage feedback

  await Promise.all([page.waitForNavigation(), await page.click("text=Manage feedback")])
  await page.waitForURL((url) => url.searchParams.has("read"))
  expectPath(page, "/manage/courses/[id]/feedback?read=false")

  await page.waitForSelector("text=Sent by")
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div")
    for (const div of divs) {
      if (div.children.length === 0 && div.textContent.includes("Sent by")) {
        div.innerHTML = "Sent by xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx at yyyy-mm-ddThh:mm:ss.xxxZ"
      }
    }
  })

  // Unread feedback view
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`feedback-unread.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Click text=Mark as read
  await page.click("text=Mark as read")
  await page.waitForSelector("text=No feedback")

  // Empty feedback view
  if (headless) {
    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot(`feedback-empty.png`, { threshold: 0.3 })
  } else {
    console.warn("Not in headless mode, skipping screenshot comparison")
  }

  // Click :nth-match(:text("Read"), 2)
  await page.click(':nth-match(:text("Read"), 2)')
  expectPath(page, "/manage/courses/[id]/feedback?read=true")

  // Click text=Mark as unread
  await page.click("text=Mark as unread")

  // Click text=Unread
  await page.click("text=Unread")
})
