import { test as base } from "@playwright/test"

import { getChatbotEmbedServerUri } from "@/utils/chatbotEmbedServer"
import { setupServer, teardownServer } from "@/utils/setupServer"

const GLOBAL_CHATBOT_CONFIGURATION_ID_TEST = "16feef52-67ba-405a-97f8-effd0653df00"
const HTML = `
<!doctype html>
  <html>
    <head>
      <title>ChatbotEmbed server</title>
    </head>
    <body>
      <iframe width="750" height="750" src="http://project-331.local/chatbot-embed/${GLOBAL_CHATBOT_CONFIGURATION_ID_TEST}"></iframe>
    </body>
  </html>
`

const chatbotEmbedServerContext = {
  port: null,
  setupCount: 0,
  setupPromise: null,
  server: null,
  html: HTML,
}

/**
 * ChatbotEmbed test fixtures. Use this test in any spec that needs the ChatbotEmbed server.
 *
 * The server is worker-scoped: one server per Playwright worker, set up before
 * any test in that worker and torn down when the worker exits.
 * See: https://playwright.dev/docs/test-fixtures#worker-scoped-fixtures
 */
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/ban-types -- Playwright extend() requires {} for the no-extra-fixtures type arg
export const test = base.extend<{}, { chatbotEmbedServer: string }>({
  chatbotEmbedServer: [
    async ({}, use) => {
      await setupServer(chatbotEmbedServerContext)
      const server = getChatbotEmbedServerUri(chatbotEmbedServerContext.port)
      await use(server)
      await teardownServer(chatbotEmbedServerContext.setupCount)
    },
    { scope: "worker", auto: true },
  ],
})

export { expect } from "@playwright/test"
export type { BrowserContext, Page } from "@playwright/test"
