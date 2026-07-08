// Typed @playwright/test wrapper around the browser host emulator. It injects the *same* emulator
// source used by playwright-cli (../browser/hostEmulatorSource) and returns an async handle whose
// methods proxy `window.__host` over `page.evaluate`.
//
// `@playwright/test` is imported for types only (erased at compile time), so this file never loads
// Playwright at runtime and jest never pulls it in.

import type { Page } from "@playwright/test"

import type {
  RecordedMessage,
  SerializableHostEmulatorOptions,
} from "../browser/hostEmulator.types"
import { HOST_EMULATOR_SOURCE } from "../browser/hostEmulatorSource"

import type { ExtendedIframeState } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

/** Result the wrapper can hand back to `sendUploadResult` (URLs are a plain object over the wire). */
export interface WireUploadResult {
  urls?: Record<string, string>
  error?: string
}

export interface WaitOptions {
  timeoutMs?: number
  intervalMs?: number
}

export interface HostEmulatorHandle {
  /** The page the emulator was installed on. */
  readonly page: Page
  /** Push a built `set-state` (from the state builders). */
  setState(state: ExtendedIframeState): Promise<void>
  /** Push a `set-state` from a view type + raw data (envelope defaults filled in-browser). */
  setStateData(viewType: string, data: unknown, overrides?: Record<string, unknown>): Promise<void>
  /** Tell the iframe the UI language (BCP 47 code). */
  setLanguage(language: string): Promise<void>
  /** Reply to a `file-upload` (use when constructed with `autoUpload: false`). */
  sendUploadResult(requestId: string | null, result: WireUploadResult): Promise<void>
  /** Reply to an `open-dialog` (use when constructed with `autoDialog: false`). */
  respondToDialog(requestId: string, confirmed: boolean): Promise<void>
  /** The most recent message of `type`, or null. */
  lastMessage(type: string): Promise<RecordedMessage | null>
  /** Full message history, optionally filtered by `type`. */
  messages(type?: string): Promise<RecordedMessage[]>
  /**
   * Poll `last(type)` until a message matches `predicate` (or any message of `type` if omitted).
   * The predicate runs in Node, so any JS works. Note: messages carrying `Map`s (file-upload /
   * upload-result) don't survive serialization — assert those in same-context jest tests instead.
   */
  waitForMessage(
    type: string,
    predicate?: (message: RecordedMessage) => boolean,
    options?: WaitOptions,
  ): Promise<RecordedMessage>
  /** Convenience for `waitForMessage("current-state", …)`. */
  waitForCurrentState(
    predicate?: (message: RecordedMessage) => boolean,
    options?: WaitOptions,
  ): Promise<RecordedMessage>
  /** Wait for the plugin to render a given view (`[data-view-type="…"]`, emitted by the Renderer). */
  waitForViewType(viewType: string, options?: { timeoutMs?: number }): Promise<void>
  /** Set files on the plugin's `<input type=file>` (drives a `file-upload`). */
  driveFileUpload(filePath: string | string[], selector?: string): Promise<void>
  /** Clear the recorded message history. */
  reset(): Promise<void>
}

/**
 * Inject the emulator into `page` (which must already be showing the plugin's iframe page, e.g.
 * `await page.goto(base + "/iframe")`) and return a typed handle.
 */
export async function createHostEmulator(
  page: Page,
  options: SerializableHostEmulatorOptions = {},
): Promise<HostEmulatorHandle> {
  // Reconstruct the emulator function from its source in Node (no CSP here), then let Playwright
  // inject it as a real function via CDP — so the page's own CSP `unsafe-eval` is never involved.
  const installEmulator = new Function(`return (${HOST_EMULATOR_SOURCE})`)() as (
    opts: SerializableHostEmulatorOptions,
  ) => string
  await page.evaluate(installEmulator, options)

  const handle: HostEmulatorHandle = {
    page,
    async setState(state) {
      await page.evaluate((s) => window.__host.setStateRaw(s as Record<string, unknown>), state)
    },
    async setStateData(viewType, data, overrides) {
      await page.evaluate(
        (args) => window.__host.setState(args.viewType, args.data, args.overrides),
        { viewType, data, overrides },
      )
    },
    async setLanguage(language) {
      await page.evaluate((code) => window.__host.setLanguage(code), language)
    },
    async sendUploadResult(requestId, result) {
      await page.evaluate((args) => window.__host.sendUploadResult(args.requestId, args.result), {
        requestId,
        result,
      })
    },
    async respondToDialog(requestId, confirmed) {
      await page.evaluate((args) => window.__host.respondToDialog(args.requestId, args.confirmed), {
        requestId,
        confirmed,
      })
    },
    async lastMessage(type) {
      return page.evaluate((t) => window.__host.last(t), type)
    },
    async messages(type) {
      return page.evaluate((t) => window.__host.messages(t), type)
    },
    async waitForMessage(type, predicate, options = {}) {
      const timeoutMs = options.timeoutMs ?? 5000
      const intervalMs = options.intervalMs ?? 50
      const deadline = Date.now() + timeoutMs
      for (;;) {
        // Scan the full history (like the in-browser `waitFor`), not just `last(type)`: a matching
        // message can be superseded by a newer one of the same type between polls, and `last` would
        // never return it.
        const history = await page.evaluate((t) => window.__host.messages(t), type)
        const match = predicate ? history.find((m) => predicate(m)) : history[0]
        if (match) {
          return match
        }
        if (Date.now() >= deadline) {
          throw new Error(`Timed out after ${timeoutMs}ms waiting for message: ${type}`)
        }
        await page.waitForTimeout(intervalMs)
      }
    },
    async waitForCurrentState(predicate, options) {
      return handle.waitForMessage("current-state", predicate, options)
    },
    async waitForViewType(viewType, options = {}) {
      await page.waitForSelector(`[data-view-type="${viewType}"]`, {
        timeout: options.timeoutMs ?? 5000,
      })
    },
    async driveFileUpload(filePath, selector = 'input[type="file"]') {
      await page.locator(selector).setInputFiles(filePath)
    },
    async reset() {
      await page.evaluate(() => window.__host.reset())
    },
  }

  return handle
}
