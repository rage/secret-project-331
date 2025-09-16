import { BrowserContext, expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.describe("Test chatbot chat box", () => {
  test.use({
    storageState: "src/states/teacher@example.com.json",
  })
  let context1: BrowserContext

  test.beforeAll(async ({ page }) => {
    await page.goto(
      "http://project-331.local/manage/courses/c7753361-5b78-4307-aad6-f139ea3865d4/other/chatbot",
    )
    await page.getByRole("button", { name: "Set as the default chatbot" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByText("Use course material search").click()
    await page.getByRole("button", { name: "Save" }).click()
  })

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
  })

  test.afterEach(async () => {
    await context1.close()
  })

  test("student can send a message to the default chatbot", async ({ headless }, testInfo) => {
    const student1Page = await context1.newPage()
    await student1Page.goto("http://project-331.local/org/uh-mathstat/courses/chatbot")
    await selectCourseInstanceIfPrompted(student1Page)

    await student1Page.getByRole("button", { name: "Open chatbot" }).click()
    await student1Page.getByRole("button", { name: "Agree" }).click()
    await student1Page.getByPlaceholder("Message").click()
    await student1Page.getByPlaceholder("Message").fill("Hello, pls help me!")
    await student1Page.getByRole("button", { name: "Send" }).click()
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: student1Page,
      headless,
      testInfo,
      snapshotName: "default-chatbot-chatbox-with-message",
      waitForTheseToBeVisibleAndStable: [student1Page.getByText("Hello! How can I assist you")],
    })

    await student1Page.getByRole("button", { name: "Show references" }).click()

    await student1Page.locator("#chatbot-citation-1-0").click()
    await expect(student1Page.getByText("Mock test page content This")).toBeVisible()
    await student1Page.locator("body").click()

    await student1Page.getByRole("button", { name: "2" }).click()
    await expect(student1Page.getByText("Mock test page content 2 This")).toBeVisible()
    await student1Page.locator("body").click()

    await student1Page.locator("#chatbot-citation-3-2").click()
    await expect(student1Page.getByText("More content on the same mock")).toBeVisible()
    await student1Page.locator("body").click()

    // try following the link
    await student1Page.getByRole("link", { name: "1Cited course page" }).click()
    await expect(student1Page.getByText("chapter 1", { exact: true })).toBeVisible()
    await expect(student1Page.getByRole("heading", { name: "The Basics" })).toBeVisible()

    // try making a new convo
    await student1Page.getByRole("button", { name: "Open chatbot" }).click()
    await expect(student1Page.getByText("Hello! How can I assist you")).toBeVisible()
    await student1Page.getByRole("button", { name: "New conversation" }).click()
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: student1Page,
      headless,
      testInfo,
      snapshotName: "default-chatbot-chatbox-with-new-conversation",
      waitForTheseToBeVisibleAndStable: [student1Page.getByText("Oh... It's you.")],
    })

    await student1Page.getByRole("button", { name: "Close" }).click()
    // ensure open chatbot button exists
    await expect(student1Page.getByRole("button", { name: "Open chatbot" })).toBeVisible()
  })

  test("Accessibility check", async ({}) => {
    const student1Page = await context1.newPage()
    await student1Page.goto("http://project-331.local/org/uh-mathstat/courses/chatbot")
    await selectCourseInstanceIfPrompted(student1Page)

    await student1Page.getByRole("button", { name: "Open chatbot" }).click()
    await accessibilityCheck(student1Page, "Default Chatbot Agree / View", [])

    await student1Page.getByRole("button", { name: "Agree" }).click()

    await accessibilityCheck(student1Page, "Default Chatbot New Conversation / View", [])

    await student1Page.getByPlaceholder("Message").click()
    await student1Page.getByPlaceholder("Message").fill("Hello, pls help me!")
    await student1Page.getByRole("button", { name: "Send" }).click()
    await accessibilityCheck(student1Page, "Default Chatbot Ongoing Conversation / View", [])

    await student1Page.getByRole("button", { name: "Show references" }).click()
    await accessibilityCheck(student1Page, "Default Chatbot Conversation With Citations / View", [])
  })
})
