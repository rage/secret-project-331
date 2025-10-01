import { BrowserContext, expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"
import { waitForAnimation } from "@/utils/waitForAnimation"

test.describe.only("Test chatbot chat box", () => {
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

  test("student uses the default chatbot", async ({ headless }, testInfo) => {
    const { chatbotDialog, student1Page } = await test.step("open chatbot box", async () => {
      const student1Page = await context1.newPage()
      await student1Page.goto(
        "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course",
      )
      await selectCourseInstanceIfPrompted(student1Page)

      await student1Page.getByRole("button", { name: "Open chatbot" }).click()
      await waitForAnimation(student1Page.getByText("About the chatbot"))

      const chatbotDialog = student1Page
        .getByRole("dialog")
        .filter({ has: student1Page.getByRole("heading", { name: "Genetic Lifeform" }) })
      expect(chatbotDialog).toBeDefined()

      return { chatbotDialog, student1Page }
    })

    await test.step("agree to terms", async () => {
      await expect(chatbotDialog.getByText("About the chatbot")).toBeVisible()
      await accessibilityCheck(student1Page, "Default Chatbot Agree / View", [])
      await chatbotDialog.getByRole("button", { name: "Agree" }).click()
      await waitForAnimation(chatbotDialog.getByText("Oh... It's you."))
      await accessibilityCheck(student1Page, "Default Chatbot New Conversation / View", [])
      await expect(chatbotDialog.getByText("Chatbots can make mistakes.")).toBeVisible()
    })

    await test.step("send message", async () => {
      await chatbotDialog.getByPlaceholder("Message").click()
      await chatbotDialog.getByPlaceholder("Message").fill("Hello, pls help me!")
      await chatbotDialog.getByRole("button", { name: "Send" }).click()
      await chatbotDialog.getByText("Hello! How can I assist you today?").waitFor()
      await accessibilityCheck(student1Page, "Default Chatbot Ongoing Conversation / View", [])
    })

    await test.step("look at references", async () => {
      await chatbotDialog.getByRole("button", { name: "Show references" }).click()
      await accessibilityCheck(
        student1Page,
        "Default Chatbot Conversation With Citations / View",
        [],
      )

      await chatbotDialog.getByLabel("Citation 1").first().click()
      await waitForAnimation(
        student1Page.getByRole("link", { name: "Cited course page", exact: true }),
      )
      await accessibilityCheck(
        student1Page,
        "Default Chatbot Conversation With Citation Popover / View",
        [],
      )
      await expect(student1Page.getByText("Mock test page content This")).toBeVisible()
      await student1Page.locator("body").click()

      await chatbotDialog.getByLabel("Citation 2").click()
      await expect(student1Page.getByText("Mock test page content 2 This")).toBeVisible()
      await student1Page.locator("body").click()

      await chatbotDialog.getByLabel("Citation 1").last().click()
      await expectScreenshotsToMatchSnapshots({
        screenshotTarget: student1Page,
        headless,
        testInfo,
        snapshotName: "default-chatbot-references-and-citation-popover",
        waitForTheseToBeVisibleAndStable: [student1Page.getByText("More content on the same mock")],
      })
      await student1Page.locator("body").click()
    })

    await test.step("try following the link in reference", async () => {
      await chatbotDialog.getByRole("link", { name: "1Cited course page" }).click()
      await student1Page.getByText("chapter 1", { exact: true }).waitFor()
      await expect(student1Page.getByRole("heading", { name: "The Basics" })).toBeVisible()
    })

    await test.step("try making a new convo", async () => {
      await student1Page.getByRole("button", { name: "Open chatbot" }).click()
      await expect(chatbotDialog.getByText("Hello! How can I assist you")).toBeVisible()
      await chatbotDialog.getByRole("button", { name: "New conversation" }).click()
      await chatbotDialog.getByText("Oh...").waitFor()
      await expect(chatbotDialog.getByText("Hello! How can I assist you")).toHaveCount(0)
    })

    await test.step("close the chatbox", async () => {
      await chatbotDialog.getByRole("button", { name: "Close" }).click()
      await expect(student1Page.getByRole("button", { name: "Open chatbot" })).toBeVisible()
    })
  })

  test("student uses course material block chatbot box", async ({ headless }, testInfo) => {
    const student1Page = await test.step("go to chatbot box", async () => {
      const student1Page = await context1.newPage()
      await student1Page.goto(
        "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course/chapter-1/page-2",
      )
      await selectCourseInstanceIfPrompted(student1Page)

      await student1Page.getByRole("heading", { name: "Test bot" }).scrollIntoViewIfNeeded()
      await expect(student1Page.getByRole("heading", { name: "Test bot" })).toBeVisible()

      return student1Page
    })

    await test.step("agree to terms", async () => {
      await expect(student1Page.getByText("About the chatbot")).toBeVisible()
      await accessibilityCheck(student1Page, "Block Chatbot Agree / View", [])
      await student1Page.getByRole("button", { name: "Agree" }).click()
      await waitForAnimation(student1Page.getByText("Haiii xD"))
      await accessibilityCheck(student1Page, "Block Chatbot New Conversation / View", [])
      await expect(student1Page.getByText("Chatbots can make mistakes.")).toBeVisible()
    })

    await test.step("send message", async () => {
      await student1Page.getByPlaceholder("Message").click()
      await student1Page.getByPlaceholder("Message").fill("Hello, pls help me!")
      await student1Page.getByRole("button", { name: "Send" }).click()
      await student1Page.getByText("Hello! How can I assist you today?").waitFor()
      await accessibilityCheck(student1Page, "Block Chatbot Ongoing Conversation / View", [])
    })

    await test.step("look at references", async () => {
      await student1Page.getByRole("button", { name: "Show references" }).click()
      await accessibilityCheck(
        student1Page,
        "Default Chatbot Conversation With Citations / View",
        [],
      )

      await student1Page.getByLabel("Citation 1").first().click()
      await waitForAnimation(
        student1Page.getByRole("link", { name: "Cited course page", exact: true }),
      )
      await accessibilityCheck(
        student1Page,
        "Block Chatbot Conversation With Citation Popover / View",
        [],
      )
      await expect(student1Page.getByText("Mock test page content This")).toBeVisible()
      await student1Page.locator("body").press("Escape")

      await student1Page.getByLabel("Citation 2").click()
      await expect(student1Page.getByText("Mock test page content 2 This")).toBeVisible()
      await student1Page.locator("body").press("Escape")

      await student1Page.getByLabel("Citation 1").last().click()
      await expectScreenshotsToMatchSnapshots({
        screenshotTarget: student1Page,
        headless,
        testInfo,
        snapshotName: "block-chatbot-references-and-citation-popover",
        waitForTheseToBeVisibleAndStable: [student1Page.getByText("More content on the same mock")],
        scrollToYCoordinate: {
          "desktop-regular": 0,
          "mobile-tall": 100,
        },
      })
      await student1Page.locator("body").press("Escape")
    })

    await test.step("try following the link in reference", async () => {
      await student1Page.getByRole("link", { name: "1Cited course page" }).click()
      await student1Page.getByText("chapter 1", { exact: true }).waitFor()
      await expect(student1Page.getByRole("heading", { name: "The Basics" })).toBeVisible()
    })

    await test.step("try making a new convo", async () => {
      await student1Page.goto(
        "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course/chapter-1/page-2",
      )
      await expect(student1Page.getByText("Hello! How can I assist you")).toBeVisible()
      await student1Page.getByRole("button", { name: "New conversation" }).click()
      await student1Page.getByText("Haiii xD").waitFor()
      await expect(student1Page.getByText("Hello! How can I assist you")).toHaveCount(0)
    })
  })
})
// todo fix agree to terms mobile
