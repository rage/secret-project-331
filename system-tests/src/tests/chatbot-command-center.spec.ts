import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"

test.describe("Chatbot command center testing", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test.beforeEach(async ({ page }) => {
    await page.goto("http://project-331.local/chatbot-command-center")
    await page.getByRole("button", { name: "New conversation" }).waitFor()
  })

  test("Infobox is shown when no conversations exist", async ({ page }) => {
    await expect(page.getByText("There are no existing")).toBeVisible()
  })

  test("Sidebar opens and closes", async ({ page }) => {
    await page.getByRole("button", { name: "Close sidebar" }).click()
    await expect(page.getByRole("button", { name: "Open sidebar" })).toBeVisible()
    await page.getByRole("button", { name: "Open sidebar" }).click()
  })

  test("New conversation dialog", async ({ page }) => {
    await page.getByRole("button", { name: "New conversation" }).click()

    await test.step("dialog opens", async () => {
      await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()
    })

    await test.step("search field for searching chatbots is visible", async () => {
      await expect(page.getByRole("searchbox", { name: "search" })).toBeVisible()
    })

    await test.step("Chatbots are grouped under courses and global chatbots", async () => {
      await expect(
        page
          .getByRole("listitem", { name: "Global chatbots", exact: true })
          .getByRole("button", { name: "Global chatbot" }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("listitem", { name: "Global chatbots", exact: true })
          .getByRole("button", { name: "Admin support bot" }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("listitem", { name: "Advanced Chatbot course", exact: true })
          .getByRole("button", { name: "Genetic Lifeform and Disk" }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("listitem", { name: "Advanced Chatbot course", exact: true })
          .getByRole("button", { name: "Test bot" }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("listitem", { name: "Advanced Chatbot course", exact: true })
          .getByRole("button", { name: "Suggestions bot" }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("listitem", { name: "Chatbot", exact: true })
          .getByRole("button", { name: "Genetic Lifeform and Disk" }),
      ).toBeVisible()
    })
  })

  test("Can create new global chatbot", async ({ page }) => {
    await page.getByTestId("sidebar-header-menu-button").click()

    await page.getByRole("menuitem", { name: "Create a new global chatbot" }).click()

    await page.getByRole("textbox", { name: "Name" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("new global chatbot")
    await page.getByRole("textbox", { name: "Overview of the chatbot's" }).click()
    await page.getByRole("textbox", { name: "Overview of the chatbot's" }).fill("test chatbot")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save" }).click()
    })
    await page.getByRole("link", { name: "Chatbot command center" }).click()
    await waitForSpinnersToDisappear(page)
    // oxlint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(100)
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()

    await expect(
      page
        .getByRole("listitem", { name: "Global chatbots", exact: true })
        .getByRole("button", { name: "new global chatbot" }),
    ).toBeVisible()
  })

  test("Can edit chatbot from dropdown", async ({ page }) => {
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()

    await page.getByRole("button", { name: "Global chatbot", exact: true }).click()

    await page.getByTestId("chatbot-header-menu-button").click()
    await page.getByText("Edit chatbot").click()
    await page.getByRole("textbox", { name: "Name" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("Global chatbot test")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click()
    })
    await page.getByRole("link", { name: "Chatbot command center" }).click()
    await waitForSpinnersToDisappear(page)
    // oxlint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(100)
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()
    await expect(
      page
        .getByRole("listitem", { name: "Global chatbots", exact: true })
        .getByRole("button", { name: "Global chatbot test" }),
    ).toBeVisible()
  })

  test("Global chatbots come first in in the dropdown menu", async ({ page }) => {
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()
    const list = page.getByRole("list", { name: "Chatbot list" })
    await expect(list.filter({ hasText: "Global chatbots" }).first()).toBeVisible()
  })

  test("Searching nonexistent chatbot returns appropriate message", async ({ page }) => {
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()
    await page.getByRole("searchbox", { name: "Search" }).fill("chatbot404")
    await expect(page.getByText("No results found")).toBeVisible()
  })

  test("Search returns correct chatbots", async ({ page }) => {
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()

    await test.step("search suggestions bot", async () => {
      await page.getByRole("searchbox", { name: "Search" }).fill("su")

      await expect(
        page
          .getByRole("listitem", { name: "Global chatbots", exact: true })
          .getByRole("button", { name: "Admin support bot" }),
      ).toBeVisible()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("button", { name: "Suggestions  bot" }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("listitem", { name: "Global chatbots", exact: true })
          .getByRole("button", { name: "Global chatbot" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("button", { name: "Genetic Lifeform and Disk" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("button", { name: "Test bot" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Chatbot", { exact: true })
          .getByRole("button", { name: "Genetic Lifeform and Disk" }),
      ).toBeHidden()
    })

    await test.step("search Genetic Lifeform and Disk Operating System bot", async () => {
      await page.getByRole("searchbox", { name: "Search" }).fill("gene")
      await expect(
        page
          .getByRole("listitem", { name: "Global chatbots", exact: true })
          .getByRole("button", { name: "Admin support bot" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("button", { name: "Suggestions  bot" }),
      ).toBeHidden()
      await expect(
        page
          .getByRole("listitem", { name: "Global chatbots", exact: true })
          .getByRole("button", { name: "Global chatbot" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("button", { name: "Genetic Lifeform and Disk" }),
      ).toBeVisible()
      await expect(
        page
          .getByLabel("Advanced Chatbot course", { exact: true })
          .getByRole("button", { name: "Test bot" }),
      ).toBeHidden()
      await expect(
        page
          .getByLabel("Chatbot", { exact: true })
          .getByRole("button", { name: "Genetic Lifeform and Disk" }),
      ).toBeVisible()
    })
  })

  test("Starting a new conversation", async ({ page }) => {
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()
    await page
      .getByLabel("Chatbot", { exact: true })
      .getByRole("button", { name: "Genetic Lifeform and Disk" })
      .click()

    await test.step("conversation is untitled if no messages have been sent", async () => {
      await expect(page.getByRole("button", { name: "untitled conversation" })).toBeVisible()
    })

    await test.step("sending first message sets the conversation title", async () => {
      await page.getByPlaceholder("Message").click()
      await page.getByPlaceholder("Message").fill("Hello, pls help me!")
      await page.getByRole("button", { name: "Send" }).click()
      await page.getByText("Hello! How can I assist you today?").waitFor()

      await expect(page.getByRole("button", { name: "Hello, pls help me!" })).toBeVisible()
    })
  })

  test("Can change between conversations", async ({ page }) => {
    await page.getByRole("button", { name: "New conversation" }).click()
    await expect(page.getByRole("heading", { name: "Chatbot selection" })).toBeVisible()
    await page
      .getByLabel("Chatbot", { exact: true })
      .getByRole("button", { name: "Genetic Lifeform and Disk" })
      .click()
    await page.getByPlaceholder("Message").click()
    await page.getByPlaceholder("Message").fill("Hello, this is our first conversation!")
    await page.getByRole("button", { name: "Send" }).click()
    await page.getByText("Hello! How can I assist you today?").waitFor()

    await page.getByTestId("chatbot-header-menu-button").click()
    await page.getByTestId("chatbot-header-menu").getByText("New conversation").click()

    await expect(page.getByRole("button", { name: "untitled conversation" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Hello! How can I assist you today?" }),
    ).toBeHidden()

    await page.getByRole("button", { name: "Hello, this is our first conversation!" }).click()
    await expect(page.getByText("Hello! How can I assist you today?")).toBeVisible()
  })
})
