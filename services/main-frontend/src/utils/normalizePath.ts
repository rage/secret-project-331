/**
 * Build a URL slug from arbitrary text (e.g. a page or course title): lowercase, ASCII-only,
 * spaces to dashes. Aggressive on purpose — it generates a fresh single-segment slug, so it is
 * the right tool for deriving a suggested path from a title, but NOT for normalizing a path the
 * user typed (it would drop case, non-ASCII characters and '/' separators). For that, use
 * `cleanUrlPath`.
 */
export const normalizePath = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Normalize a user-entered URL path the same way the backend stores it: strip the unsafe ASCII
 * punctuation, turn whitespace into '-', and collapse/trim dashes per segment — while preserving
 * letter case, non-ASCII characters (e.g. Cyrillic), and the '/' segment separators, '.', '_' and
 * '~'. Mirrors `clean_url_path` in the page-path migration and the
 * `normalize_url_path_for_storage` / `URL_PATH_ENCODE_SET` rules in
 * services/headless-lms/models/src/pages.rs; keep the three in agreement.
 *
 * Unlike `normalizePath` this is non-destructive for an already-clean path, so running it on blur
 * does not silently rename an existing page that legitimately uses uppercase or non-ASCII
 * characters.
 */
export const cleanUrlPath = (path: string): string => {
  let decoded = path
  try {
    // A pasted path may be percent-encoded; decode it so it is cleaned like the backend does.
    decoded = decodeURIComponent(path)
  } catch {
    // Leave malformed percent sequences as-is rather than throwing.
  }
  // The unsafe ASCII set (URL_PATH_ENCODE_SET): everything stripped here is unsafe punctuation or a
  // control character; alphanumerics, '/', '-', '.', '_', '~' and all non-ASCII are kept.
  // eslint-disable-next-line no-control-regex
  const unsafeAscii = /[\x00-\x2C\x3A-\x40\x5B-\x5E\x60\x7B-\x7D\x7F]/g
  return decoded
    .replace(/\s+/g, "-")
    .replace(unsafeAscii, "")
    .replace(/-{2,}/g, "-")
    .replace(/-+\//g, "/")
    .replace(/\/-+/g, "/")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}
