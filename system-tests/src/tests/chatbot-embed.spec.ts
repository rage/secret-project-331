import { expect, test } from "../fixtures/chatbotEmbed"

test("visit chatbot embed server", async ({ page, chatbotEmbedServerPort }) => {
  await page.goto(`http://127.0.0.1:${chatbotEmbedServerPort}`)

  await expect(page).toHaveTitle("AAAAAAAa")
})
