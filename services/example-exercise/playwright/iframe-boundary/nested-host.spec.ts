// Iframe-boundary test: exercise the real sandboxed, distinct-origin MessageChannel handshake.
// Keep host emulators in plugin-contract tests; this level proves the browser boundary itself.

import { expect, test as base } from "@playwright/test"

import { createNestedHostEmulator } from "@/shared-module/exercise-service-test-utils/playwright/createHostEmulator"
import { exerciseEditorState } from "@/shared-module/exercise-service-test-utils/protocol/stateBuilders"

import { withBrowserDiagnostics } from "../fixtures/diagnostics"

const test = withBrowserDiagnostics(base)

test("delivers state through a sandboxed distinct-origin iframe", async ({ page, baseURL }) => {
  if (!baseURL) {
    throw new Error("The iframe-boundary project requires a Playwright baseURL")
  }

  const pluginUrl = new URL("/iframe", baseURL)
  const hostUrl = new URL(baseURL)
  // localhost and 127.0.0.1 are distinct origins while using the same local development server.
  hostUrl.hostname = hostUrl.hostname === "localhost" ? "127.0.0.1" : "localhost"

  const host = await createNestedHostEmulator(page, {
    hostUrl: hostUrl.toString(),
    iframeUrl: pluginUrl.toString(),
    iframeTitle: "Example exercise boundary",
  })

  await expect(host.iframe).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-downloads allow-same-origin",
  )
  await host.setState(
    exerciseEditorState({
      private_spec: [
        { id: "11111111-1111-1111-1111-111111111111", name: "Helsinki", correct: true },
      ],
    }),
  )
  await host.waitForViewType("exercise-editor")

  const state = await host.waitForCurrentState((message) =>
    Array.isArray(
      (message.data as { private_spec?: { alternatives?: unknown } }).private_spec?.alternatives,
    ),
  )
  expect((state.data as { private_spec: { version: string } }).private_spec.version).toBe("1")
})
