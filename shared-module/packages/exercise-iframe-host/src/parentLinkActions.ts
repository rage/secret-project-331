/**
 * Host-side policy for the iframe's `open-link` and `download-file` requests.
 *
 * Both messages are "please do this in the top-level page" commands coming from plugin code the host
 * does not control, so the host decides what is safe to do with them: only absolute http(s) URLs, and
 * never a navigation that could replace the page the exercise is embedded in. The user-facing
 * confirmation lives in `useIframeLinkRequests`; this module is the DOM + validation half, kept free
 * of React so it can be unit tested on its own.
 */

/** Parses `raw` and returns it only if it is an absolute http(s) URL. */
export const parseSafeHttpUrl = (raw: unknown): URL | null => {
  if (typeof raw !== "string") {
    return null
  }
  let url: URL
  try {
    // No base on purpose: the protocol asks for absolute URLs, and resolving a relative one against
    // the host page would silently point the request at the host app instead of the plugin's file.
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null
  }
  return url
}

/** Longest file name we pass on to the browser; well under every filesystem's limit. */
const MAX_FILENAME_LENGTH = 200

/**
 * Turns a plugin-suggested download name into something safe to hand to the browser: no directory
 * components, no control characters, no relative-path names. Returns null when nothing usable is
 * left, which makes the browser derive the name from the response instead.
 */
export const sanitizeDownloadFilename = (raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null
  }
  const cleaned = raw
    .replaceAll(/[/\\]+/g, "_")
    // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
    .replaceAll(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_FILENAME_LENGTH)
  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    return null
  }
  return cleaned
}

/**
 * Opens `url` in a new tab. Returns false when the browser blocked the popup, which is worth
 * reporting: the request came from a click the user made inside the iframe, so silently doing nothing
 * looks like a broken link.
 */
export const openUrlInNewTab = (url: string): boolean =>
  window.open(url, "_blank", "noopener,noreferrer") !== null

/** How long a blob URL is kept alive so a slow save can still read it before it's freed. */
const OBJECT_URL_LIFETIME_MS = 30_000

/**
 * Clicks a throwaway `<a download>`. `newTab` is the fallback's safety net: browsers ignore `download`
 * for a cross-origin response and would otherwise navigate the host page away from the exercise. A
 * `blob:` URL never navigates anywhere, so the caller passes `newTab: false` for it.
 */
const clickDownloadLink = (
  url: string,
  filename: string | null,
  { newTab }: { newTab: boolean },
): void => {
  const link = document.createElement("a")
  link.href = url
  if (newTab) {
    link.target = "_blank"
    link.rel = "noopener noreferrer"
  }
  // An empty value still marks this a download; the browser then names the file from the response.
  link.download = filename ?? ""
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
  }
}

/**
 * Above this, buffering the whole response into memory for a blob download risks exhausting the tab's
 * memory before the browser ever gets to save it. Generous for a submitted file, but a cap all the
 * same: this module serves every exercise type, not just ones with small answers.
 */
export const MAX_BLOB_DOWNLOAD_BYTES = 200 * 1024 * 1024

/** Thrown by {@link readBodyWithinLimit} once the response has grown past `MAX_BLOB_DOWNLOAD_BYTES`. */
class ResponseTooLargeError extends Error {}

/**
 * Reads `response`'s body into a `Blob`, refusing once more than `MAX_BLOB_DOWNLOAD_BYTES` has arrived.
 * `response.blob()` would buffer without limit; streaming lets a huge response be caught, and the
 * in-flight read cancelled, instead of buffered in full first.
 */
const readBodyWithinLimit = async (response: Response): Promise<Blob> => {
  const reader = response.body?.getReader()
  if (!reader) {
    // No stream to size-check as it arrives (an already-consumed response, or an environment without
    // streaming fetch) — refuse rather than fall back to an unbounded `response.blob()`, which would
    // defeat the whole point of this function.
    throw new Error("Response has no readable body")
  }
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let receivedBytes = 0
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- each read depends on the last; nothing to parallelize
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    receivedBytes += value.byteLength
    if (receivedBytes > MAX_BLOB_DOWNLOAD_BYTES) {
      await reader.cancel()
      throw new ResponseTooLargeError(`Response exceeded ${MAX_BLOB_DOWNLOAD_BYTES} bytes`)
    }
    // Copied onto a fresh, plain ArrayBuffer: `BlobPart` refuses a view that could be backed by a
    // SharedArrayBuffer, which is what the reader's own typed-array type admits.
    chunks.push(new Uint8Array(value))
  }
  return new Blob(chunks, { type: response.headers.get("Content-Type") ?? "" })
}

/**
 * Downloads `url`, suggesting `filename` for the saved file.
 *
 * Every platform file URL redirects to cross-origin storage, and browsers ignore `download` for a
 * cross-origin response — so a direct link only ever opens the file for viewing. Fetching the bytes
 * and downloading the resulting `blob:` URL forces a real save regardless of the file's origin, since
 * `download` is always honored for blobs. Falls back to a direct link — today's best-effort behavior —
 * if the fetch itself fails, the response is blocked by CORS, or it is too large to buffer safely, so
 * neither a storage backend that never grants this origin CORS access nor an oversized file is worse
 * off than before.
 */
export const startFileDownload = async (url: string, filename: string | null): Promise<void> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Unexpected response status ${response.status}`)
    }
    const objectUrl = URL.createObjectURL(await readBodyWithinLimit(response))
    clickDownloadLink(objectUrl, filename, { newTab: false })
    // Revoking right away can truncate the save in some browsers; give it time to start reading first.
    setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_LIFETIME_MS)
  } catch (error) {
    console.warn(
      "[MessageChannelIFrame] Downloading via fetch failed, falling back to a direct link",
      error,
    )
    clickDownloadLink(url, filename, { newTab: true })
  }
}
