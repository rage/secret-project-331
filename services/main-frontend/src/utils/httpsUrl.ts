/**
 * `url` when it is an absolute `https:` URL, otherwise null. For links teachers type in, so one
 * such as `javascript:` never reaches an `href` or a redirect.
 */
export const httpsUrlOrNull = (url: string | null | undefined): string | null => {
  if (!url) {
    return null
  }
  try {
    return new URL(url).protocol === "https:" ? url : null
  } catch {
    return null
  }
}
