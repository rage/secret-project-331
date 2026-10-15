import type {
  DownloadFileMessage,
  OpenLinkMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

/**
 * The subset of {@link MessagePort} these helpers need. Declaring it as an interface (rather than
 * depending on the DOM `MessagePort`) keeps them easy to unit test with a fake port. A real
 * `MessagePort` is structurally assignable to this.
 */
export interface LinkCapableMessagePort {
  postMessage: (message: unknown) => void
}

/** What to download, and what to call the saved file. */
export interface FileDownloadRequest {
  /** Absolute http(s) URL of the file, e.g. a URL the host returned from a `file-upload`. */
  url: string
  /** Suggested name for the saved file; the parent sanitizes it and may not be able to honor it. */
  filename?: string | null
}

/** Thrown when a request cannot be honored no matter what the user would answer. */
export class LinkRequestError extends Error {}

/**
 * Rejects anything that isn't an absolute http(s) URL before it reaches the wire. The parent checks
 * this again — it can't trust the iframe — but failing here turns a typo into an exception the
 * exercise can react to instead of a request the host silently drops.
 */
const assertAbsoluteHttpUrl = (url: string): void => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new LinkRequestError(`Not an absolute URL: ${url}`)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LinkRequestError(`Only http(s) URLs can be opened or downloaded: ${url}`)
  }
}

/**
 * Asks the parent to open `url` in a new browser tab. An exercise cannot open one itself: its iframe
 * is sandboxed without `allow-popups`, and navigating in the iframe would replace the exercise.
 *
 * The parent asks the user to confirm, showing the URL, and never reports back what they chose — so
 * treat this as a request, not a guarantee, and don't block any part of the UI on it. Throws a
 * {@link LinkRequestError} for a URL the parent would refuse anyway.
 */
export const requestOpenLink = (port: LinkCapableMessagePort, url: string): void => {
  assertAbsoluteHttpUrl(url)
  const message: OpenLinkMessage = { message: "open-link", data: url }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- postMessage has no targetOrigin param
  port.postMessage(message)
}

/**
 * Asks the parent to download a file for the user. Confirmed by the user and fire-and-forget exactly
 * like {@link requestOpenLink}; the suggested `filename` is a hint, since browsers ignore it for
 * cross-origin responses.
 */
export const requestFileDownload = (
  port: LinkCapableMessagePort,
  request: FileDownloadRequest,
): void => {
  assertAbsoluteHttpUrl(request.url)
  const message: DownloadFileMessage = {
    message: "download-file",
    url: request.url,
    filename: request.filename ?? null,
  }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- postMessage has no targetOrigin param
  port.postMessage(message)
}
