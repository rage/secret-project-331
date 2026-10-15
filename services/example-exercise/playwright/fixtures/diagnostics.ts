import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType,
} from "@playwright/test"

type BaseTest = TestType<
  PlaywrightTestArgs & PlaywrightTestOptions,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>

/** Make silent browser failures actionable alongside the retained Playwright artifacts. */
export function withBrowserDiagnostics(test: BaseTest): BaseTest {
  return test.extend({
    page: async ({ page }, runWithPage, testInfo) => {
      const diagnostics: string[] = []

      page.on("pageerror", (error) => {
        diagnostics.push(`pageerror: ${error.stack ?? error.message}`)
      })
      page.on("console", (message) => {
        const text = message.text()
        // Firefox reports the browser's expected SameSite cookie policy for the intentionally
        // cross-origin iframe as a console error. It is not emitted by the plugin application.
        if (
          message.type() === "error" &&
          !(/Cookie .*rejected/.test(text) && text.includes("SameSite"))
        ) {
          diagnostics.push(`console.error: ${text}`)
        }
      })
      page.on("requestfailed", (request) => {
        diagnostics.push(
          `requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
        )
      })

      await runWithPage(page)

      if (diagnostics.length > 0) {
        const body = diagnostics.join("\n")
        await testInfo.attach("browser-diagnostics", { body, contentType: "text/plain" })
        throw new Error(`Unexpected browser diagnostics:\n${body}`)
      }
    },
  })
}
