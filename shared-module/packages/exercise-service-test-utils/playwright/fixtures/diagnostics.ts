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

/**
 * Playwright's artifact settings retain the browser state after a failure. This fixture also turns
 * silent browser failures into test failures, so page errors, console errors, and failed requests
 * cannot be missed by a passing contract assertion.
 */
export function withBrowserDiagnostics(test: BaseTest): BaseTest {
  return test.extend({
    page: async ({ page }, runWithPage, testInfo) => {
      const diagnostics: string[] = []

      page.on("pageerror", (error) => {
        diagnostics.push(`pageerror: ${error.stack ?? error.message}`)
      })
      page.on("console", (message) => {
        if (message.type() === "error") {
          diagnostics.push(`console.error: ${message.text()}`)
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
