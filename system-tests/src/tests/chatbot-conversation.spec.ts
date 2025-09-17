import { BrowserContext, expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.describe("Test chatbot chat box", () => {
  test.use({
    storageState: "src/states/teacher@example.com.json",
  })
  let context1: BrowserContext
  let context2: BrowserContext

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
    context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
  })

  test.afterEach(async () => {
    await context1.close()
    await context2.close()
  })

  test("student sends a message to the default chatbot", async ({ headless }, testInfo) => {
    const student1Page = await context1.newPage()
    await student1Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course",
    )
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
      snapshotName: "default-chatbot-with-message",
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
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: student1Page,
      headless,
      testInfo,
      snapshotName: "default-chatbot-references-and-citation-popover",
      waitForTheseToBeVisibleAndStable: [student1Page.getByText("More content on the same mock")],
    })
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
      snapshotName: "default-chatbot-with-new-conversation",
      waitForTheseToBeVisibleAndStable: [student1Page.getByText("Oh... It's you.")],
    })

    await student1Page.getByRole("button", { name: "Close" }).click()
    // ensure open chatbot button exists
    await expect(student1Page.getByRole("button", { name: "Open chatbot" })).toBeVisible()
  })

  test("student uses course material block chatbot box", async ({ headless }, testInfo) => {
    const student1Page = await context1.newPage()
    await student1Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course/chapter-1/page-2",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page.getByRole("heading", { name: "Test bot" }).scrollIntoViewIfNeeded()
    await expect(student1Page.getByRole("heading", { name: "Test bot" })).toBeVisible()
    await student1Page.getByRole("button", { name: "Agree" }).click()
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: student1Page,
      headless,
      testInfo,
      snapshotName: "course-material-block-chatbot-with-new-conversation",
      waitForTheseToBeVisibleAndStable: [student1Page.getByText("Haiii xD")],
    })

    await student1Page.getByPlaceholder("Message").scrollIntoViewIfNeeded()
    await student1Page.getByPlaceholder("Message").click()
    await student1Page.getByPlaceholder("Message").fill("Hello, pls help me!")
    await student1Page.getByRole("button", { name: "Send" }).click()
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: student1Page,
      headless,
      testInfo,
      snapshotName: "course-material-block-chatbot-with-message",
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
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: student1Page,
      headless,
      testInfo,
      snapshotName: "course-material-block-chatbot-references-and-citation-popover",
      waitForTheseToBeVisibleAndStable: [student1Page.getByText("More content on the same mock")],
    })
    await student1Page.locator("body").click()

    // try making a new convo
    await student1Page.getByRole("button", { name: "New conversation" }).click()
    await expect(student1Page.getByText("Haiii xD")).toBeVisible()
    await expect(student1Page.getByText("Hello, pls help")).toHaveCount(0)
  })

  test("Accessibility check default chatbot", async ({}) => {
    const student2Page = await context2.newPage()
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course",
    )
    await selectCourseInstanceIfPrompted(student2Page)

    await student2Page.getByRole("button", { name: "Open chatbot" }).click()
    await accessibilityCheck(student2Page, "Default Chatbot Agree / View", [])

    await student2Page.getByRole("button", { name: "Agree" }).click()

    await accessibilityCheck(student2Page, "Default Chatbot New Conversation / View", [])

    await student2Page.getByPlaceholder("Message").click()
    await student2Page.getByPlaceholder("Message").fill("Hello, pls help me!")
    await student2Page.getByRole("button", { name: "Send" }).click()
    await accessibilityCheck(student2Page, "Default Chatbot Ongoing Conversation / View", [])

    await student2Page.getByRole("button", { name: "Show references" }).click()
    await accessibilityCheck(student2Page, "Default Chatbot Conversation With Citations / View", [])
  })

  test("Accessibility check course material block chatbot", async ({}) => {
    const student2Page = await context2.newPage()
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course/chapter-1/page-2",
    )
    await selectCourseInstanceIfPrompted(student2Page)

    await accessibilityCheck(student2Page, "Block Chatbot Agree / View", [])

    await student2Page.getByRole("button", { name: "Agree" }).click()

    await accessibilityCheck(student2Page, "Block Chatbot New Conversation / View", [])

    await student2Page.getByPlaceholder("Message").click()
    await student2Page.getByPlaceholder("Message").fill("Hello, pls help me!")
    await student2Page.getByRole("button", { name: "Send" }).click()
    await accessibilityCheck(student2Page, "Block Chatbot Ongoing Conversation / View", [])

    await student2Page.getByRole("button", { name: "Show references" }).click()
    await accessibilityCheck(student2Page, "Block Chatbot Conversation With Citations / View", [])
  })
})
