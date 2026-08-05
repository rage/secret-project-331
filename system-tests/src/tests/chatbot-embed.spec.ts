import { expect, test } from "../fixtures/chatbotEmbed"

test.describe("Chatbot iframe embed testing", () => {
  test.beforeEach(async ({ page, chatbotEmbedServerPort }) => {
    await page.goto(`http://127.0.0.1:${chatbotEmbedServerPort}`)
  })

  test("Chatbot is visible", async ({ page }) => {
    await expect(
      page.locator("iframe").contentFrame().getByRole("heading", { name: "Global chatbot" }),
    ).toBeVisible()
    await expect(
      page.locator("iframe").contentFrame().getByRole("heading", { name: "About the chatbot" }),
    ).toBeVisible()
    await expect(
      page.locator("iframe").contentFrame().getByRole("button", { name: "Agree" }),
    ).toBeVisible()
  })

  test("Chatbot is used", async ({ page }) => {
    await test.step("agree to terms", async () => {
      await expect(
        page.locator("iframe").contentFrame().getByRole("heading", { name: "About the chatbot" }),
      ).toBeVisible()
      await page.locator("iframe").contentFrame().getByRole("button", { name: "Agree" }).click()
      await expect(
        page.locator("iframe").contentFrame().getByText("Chatbots can make mistakes."),
      ).toBeVisible()

      await expect(
        page.locator("iframe").contentFrame().getByText("Ah, there you are, my dear"),
      ).toBeVisible()
    })

    await test.step("send message", async () => {
      await page.locator("iframe").contentFrame().getByPlaceholder("Message").click()
      await page
        .locator("iframe")
        .contentFrame()
        .getByPlaceholder("Message")
        .fill("Hello you old bean, we shall begin!")
      await page.locator("iframe").contentFrame().getByRole("button", { name: "Send" }).click()
      await page.locator("iframe").contentFrame().getByText("Hello! How can I assist you").waitFor()
    })

    await test.step("start new conversation", async () => {
      await page.locator("iframe").contentFrame().getByTestId("chatbot-header-menu-button").click()
      await page.locator("iframe").contentFrame().getByText("New conversation").click()
      await expect(
        page.locator("iframe").contentFrame().getByRole("heading", { name: "Global chatbot" }),
      ).toBeVisible()
      await expect(
        page.locator("iframe").contentFrame().getByRole("heading", { name: "About the chatbot" }),
      ).toBeVisible()
      await expect(
        page.locator("iframe").contentFrame().getByRole("button", { name: "Agree" }),
      ).toBeVisible()
    })
  })
})
