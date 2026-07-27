// Typed @playwright/test wrapper around the browser host emulator. It injects the *same* emulator
// source used by playwright-cli (../browser/hostEmulatorSource) and returns an async handle whose
// methods proxy `window.__host` over `page.evaluate`.
//
// `@playwright/test` is imported for types only (erased at compile time), so this file never loads
// Playwright at runtime and jest never pulls it in.

import type { FrameLocator, Locator, Page } from "@playwright/test"

import type { ExtendedIframeState } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import type {
  FileUploadSnapshot,
  RecordedMessage,
  SerializableHostEmulatorOptions,
} from "../browser/hostEmulator.types"
import { HOST_EMULATOR_SOURCE } from "../browser/hostEmulatorSource"

/** Result the wrapper can hand back to `sendUploadResult` (plain structured-clone data). */
export interface WireUploadResult {
  files?: { id: string; url: string }[]
  error?: string
}

export interface WaitOptions {
  timeoutMs?: number
  intervalMs?: number
}

export type FileInputFiles = Parameters<import("@playwright/test").Locator["setInputFiles"]>[0]

export interface HostEmulatorHandle {
  /** The page the emulator was installed on. */
  readonly page: Page
  /** Push a built `set-state` (from the state builders). */
  setState: (state: ExtendedIframeState) => Promise<void>
  /** Push a `set-state` from a view type + raw data (envelope defaults filled in-browser). */
  setStateData: (
    viewType: string,
    data: unknown,
    overrides?: Record<string, unknown>,
  ) => Promise<void>
  /** Tell the iframe the UI language (BCP 47 code). */
  setLanguage: (language: string) => Promise<void>
  /** Reply to a `file-upload` (use when constructed with `autoUpload: false`). */
  sendUploadResult: (requestId: string, result: WireUploadResult) => Promise<void>
  /** Reply to an `open-dialog` (use when constructed with `autoDialog: false`). */
  respondToDialog: (requestId: string, confirmed: boolean) => Promise<void>
  /** The most recent message of `type`, or null. */
  lastMessage: (type: string) => Promise<RecordedMessage | null>
  /** Full message history, optionally filtered by `type`. */
  messages: (type?: string) => Promise<RecordedMessage[]>
  /**
   * Poll `last(type)` until a message matches `predicate` (or any message of `type` if omitted).
   * The predicate runs in Node, so any JS works. File payloads are exposed through
   * `waitForFileUpload`, which records browser-realm metadata and hashes rather than serializing
   * `File` instances across the Playwright boundary.
   */
  waitForMessage: (
    type: string,
    predicate?: (message: RecordedMessage) => boolean,
    options?: WaitOptions,
  ) => Promise<RecordedMessage>
  /** Convenience for `waitForMessage("current-state", …)`. */
  waitForCurrentState: (
    predicate?: (message: RecordedMessage) => boolean,
    options?: WaitOptions,
  ) => Promise<RecordedMessage>
  /** Wait for a browser-realm snapshot of a `file-upload`, including Blob/File hashes. */
  waitForFileUpload: (
    predicate?: (upload: FileUploadSnapshot) => boolean,
    options?: WaitOptions,
  ) => Promise<FileUploadSnapshot>
  /** Number of `file-upload` messages received since construction or the last reset. */
  fileUploadCount: () => Promise<number>
  /** Wait for the plugin to render a given view (`[data-view-type="…"]`, emitted by the Renderer). */
  waitForViewType: (viewType: string, options?: { timeoutMs?: number }) => Promise<void>
  /** Set files on the plugin's `<input type=file>` (drives a `file-upload`). */
  driveFileUpload: (files: FileInputFiles, target?: string | Locator) => Promise<void>
  /** Clear the recorded message history and upload snapshots. */
  reset: () => Promise<void>
}

export interface NestedHostEmulatorOptions extends SerializableHostEmulatorOptions {
  hostUrl: string
  iframeUrl: string
  iframeTitle?: string
}

export interface NestedHostEmulatorHandle extends HostEmulatorHandle {
  readonly iframe: Locator
  readonly frame: FrameLocator
}

function createHandle(page: Page, contentRoot: Page | FrameLocator = page): HostEmulatorHandle {
  const handle: HostEmulatorHandle = {
    page,
    async setState(state) {
      await page.evaluate(
        (s) => window.__host.setStateRaw(s as unknown as Record<string, unknown>),
        state,
      )
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
    lastMessage(type) {
      return page.evaluate((t) => window.__host.last(t), type)
    },
    messages(type) {
      return page.evaluate((t) => window.__host.messages(t), type)
    },
    async waitForMessage(type, predicate, waitOptions = {}) {
      const timeoutMs = waitOptions.timeoutMs ?? 5000
      const intervalMs = waitOptions.intervalMs ?? 50
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
    waitForCurrentState(predicate, waitOptions) {
      return handle.waitForMessage("current-state", predicate, waitOptions)
    },
    async waitForFileUpload(predicate, waitOptions = {}) {
      const timeoutMs = waitOptions.timeoutMs ?? 5000
      const intervalMs = waitOptions.intervalMs ?? 50
      const deadline = Date.now() + timeoutMs
      for (;;) {
        // The browser API hashes File/Blob bytes before exposing these snapshots. Polling the
        // serialization-safe snapshots also lets the caller's predicate remain ordinary Node JS.
        const uploads = await page.evaluate(() => window.__host.fileUploads())
        const match = predicate ? uploads.find((upload) => predicate(upload)) : uploads[0]
        if (match) {
          return match
        }
        if (Date.now() >= deadline) {
          throw new Error(`Timed out after ${timeoutMs}ms waiting for file-upload`)
        }
        await page.waitForTimeout(intervalMs)
      }
    },
    fileUploadCount() {
      return page.evaluate(() => window.__host.fileUploadCount())
    },
    async waitForViewType(viewType, waitOptions = {}) {
      await contentRoot
        .locator(`[data-view-type="${viewType}"]`)
        .waitFor({ timeout: waitOptions.timeoutMs ?? 5000 })
    },
    async driveFileUpload(files, target = 'input[type="file"]') {
      const input = typeof target === "string" ? contentRoot.locator(target) : target
      await input.setInputFiles(files)
    },
    async reset() {
      await page.evaluate(() => window.__host.reset())
    },
  }

  return handle
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
  return createHandle(page)
}

/**
 * Open a host page and mount the plugin in a sandboxed, distinct-origin iframe. The emulator lives
 * in the host realm and transfers its MessagePort to the nested plugin, matching the real browser
 * boundary while retaining the same host-driving API as `createHostEmulator`.
 */
export async function createNestedHostEmulator(
  page: Page,
  options: NestedHostEmulatorOptions,
): Promise<NestedHostEmulatorHandle> {
  const { hostUrl, iframeUrl, iframeTitle = "Exercise plugin", ...emulatorOptions } = options

  await page.goto(hostUrl)
  const actualHostOrigin = new URL(page.url()).origin
  const resolvedIframeUrl = new URL(iframeUrl, page.url()).toString()
  if (new URL(resolvedIframeUrl).origin === actualHostOrigin) {
    throw new Error("createNestedHostEmulator requires hostUrl and iframeUrl on distinct origins")
  }

  const installNestedEmulator = new Function(`return (args) => {
    document.title = args.iframeTitle + " host"
    document.body.replaceChildren()
    const iframe = document.createElement("iframe")
    iframe.dataset.exerciseHostEmulator = "true"
    iframe.title = args.iframeTitle
    iframe.sandbox = "allow-scripts allow-forms allow-downloads allow-same-origin"
    iframe.src = args.iframeUrl
    const nestedOptions = Object.assign({}, args.emulatorOptions, {
      transferPort: (port) => iframe.contentWindow.postMessage("communication-port", "*", [port]),
    })
    const result = (${HOST_EMULATOR_SOURCE})(nestedOptions)
    document.body.appendChild(iframe)
    return result
  }`)() as (args: {
    iframeTitle: string
    iframeUrl: string
    emulatorOptions: SerializableHostEmulatorOptions
  }) => string

  await page.evaluate(installNestedEmulator, {
    iframeTitle,
    iframeUrl: resolvedIframeUrl,
    emulatorOptions,
  })

  const selector = 'iframe[data-exercise-host-emulator="true"]'
  const iframe = page.locator(selector)
  await iframe.waitFor({ state: "attached" })
  const frame = page.frameLocator(selector)
  return {
    ...createHandle(page, frame),
    iframe,
    frame,
  }
}
