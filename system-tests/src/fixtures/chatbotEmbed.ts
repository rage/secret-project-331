import { test as base } from "@playwright/test"

import {
  setupChatbotEmbedServer,
  teardownChatbotEmbedServer,
  getChatbotEmbedServer,
} from "../utils/chatbotEmbedServer"

/**
 * ChatbotEmbed test fixtures. Use this test in any spec that needs the ChatbotEmbed server.
 *
 * The server is worker-scoped: one server per Playwright worker, set up before
 * any test in that worker and torn down when the worker exits.
 * See: https://playwright.dev/docs/test-fixtures#worker-scoped-fixtures
 */
// Empty object type required by Playwright's extend() for "no extra test fixtures"
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/ban-types -- Playwright extend() requires {} for the no-extra-fixtures type arg
export const test = base.extend<{}, { chatbotEmbedServer: string }>({
  chatbotEmbedServer: [
    async ({}, use) => {
      await setupChatbotEmbedServer()
      const server = getChatbotEmbedServer()
      await use(server)
      await teardownChatbotEmbedServer()
    },
    { scope: "worker", auto: true },
  ],
})

export { expect } from "@playwright/test"
export type { BrowserContext, Page } from "@playwright/test"
