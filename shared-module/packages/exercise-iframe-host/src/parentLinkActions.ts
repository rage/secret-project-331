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

/**
 * Starts downloading `url`, suggesting `filename` for the saved file.
 *
 * `target="_blank"` is the safety net rather than the goal: browsers ignore `download` for
 * cross-origin responses, and without a target such a URL would navigate the host page away from the
 * exercise. When `download` is honored the browser downloads the file and opens no tab at all.
 */
export const startFileDownload = (url: string, filename: string | null): void => {
  const link = document.createElement("a")
  link.href = url
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  // An empty value still marks this a download; the browser then names the file from the response.
  link.download = filename ?? ""
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
  }
}
