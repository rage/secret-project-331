import { expect, test } from "@playwright/test"

test.describe("Chatbot command center testing", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test.beforeEach(async ({ page }) => {
    await page.goto("http://project-331.local/chatbot-command-center")
    await page.getByRole("heading", { name: "Chatbot command center" }).waitFor()
    await page.getByText("Chatbot to test").waitFor()
    await page.getByRole("button", { name: "Chatbot to test" }).click({ delay: 50 })
  })

  test("Search field for searching chatbots is visible", async ({ page }) => {
    await expect(page.getByRole("searchbox", { name: "Search chatbot" })).toBeVisible()
  })

  test("Chatbots are grouped under courses and global chatbots", async ({ page }) => {
    await expect(
      page
        .getByLabel("Global chatbots", { exact: true })
        .getByRole("option", { name: "Global chatbot" }),
    ).toBeVisible()
    await expect(
      page
        .getByLabel("Chatbot", { exact: true })
        .getByRole("option", { name: "Genetic Lifeform and Disk" }),
    ).toBeVisible()
    await expect(
      page
        .getByLabel("Advanced Chatbot course", { exact: true })
        .getByRole("option", { name: "Genetic Lifeform and Disk" }),
    ).toBeVisible()
    await expect(
      page
        .getByLabel("Advanced Chatbot course", { exact: true })
        .getByRole("option", { name: "Test bot" }),
    ).toBeVisible()
    await expect(
      page
        .getByLabel("Advanced Chatbot course", { exact: true })
        .getByRole("option", { name: "Suggestions  bot" }),
    ).toBeVisible()
  })

  test("Global chatbots come first in in the dropdown menu", async ({ page }) => {
    const dropdown = page.getByRole("listbox", { name: "Chatbot to test" })
    await expect(dropdown.getByRole("option").first()).toHaveText("Global chatbot")
  })

  test("Chatbot is used after selecting it from the dropdown menu", async ({ page }) => {
    await page
      .getByLabel("Chatbot", { exact: true })
      .getByRole("option", { name: "Genetic Lifeform and Disk" })
      .click()

    await test.step("agree to terms", async () => {
      await expect(page.getByText("About the chatbot")).toBeVisible()
      await page.getByRole("button", { name: "Agree" }).click()
      await expect(page.getByText("Chatbots can make mistakes.")).toBeVisible()
    })

    await test.step("send message", async () => {
      await page.getByPlaceholder("Message").click()
      await page.getByPlaceholder("Message").fill("Hello, pls help me!")
      await page.getByRole("button", { name: "Send" }).click()
      await page.getByText("Hello! How can I assist you today?").waitFor()
    })
  })

  test("Searching nonexistent chatbot returns appropriate message", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search chatbot" }).fill("chatbot404")
    await expect(page.getByText("No results found")).toBeVisible()
  })

  test("Search returns correct chatbots", async ({ page }) => {
    await test.step("search suggestions bot", async () => {
      await page.getByRole("searchbox", { name: "Search chatbot" }).fill("su")
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("option", { name: "Suggestions  bot" }),
      ).toBeVisible()
      await expect(
        page
          .getByLabel("Chatbot", { exact: true })
          .getByRole("option", { name: "Genetic Lifeform and Disk" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("option", { name: "Genetic Lifeform and Disk" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("option", { name: "Test bot" }),
      ).toBeHidden()
    })

    await test.step("search Genetic Lifeform and Disk Operating System bot", async () => {
      await page.getByRole("searchbox", { name: "Search chatbot" }).fill("gene")
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("option", { name: "Suggestions  bot" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Chatbot", { exact: true })
          .getByRole("option", { name: "Genetic Lifeform and Disk" }),
      ).toBeVisible()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("option", { name: "Genetic Lifeform and Disk" }),
      ).toBeVisible()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("option", { name: "Test bot" }),
      ).toBeHidden()
    })
  })
})
