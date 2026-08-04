import { test as base } from "@playwright/test"

import {
  getChatbotEmbedPort,
  setupChatbotEmbedServer,
  teardownChatbotEmbedServer,
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
export const test = base.extend<{}, { chatbotEmbedServerPort: number }>({
  chatbotEmbedServerPort: [
    async ({}, use) => {
      await setupChatbotEmbedServer()
      const port = getChatbotEmbedPort()
      await use(port)
      await teardownChatbotEmbedServer()
    },
    { scope: "worker", auto: true },
  ],
})

export { expect } from "@playwright/test"
export type { BrowserContext, Page } from "@playwright/test"
