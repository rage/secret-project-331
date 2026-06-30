/**
 * Build a URL slug from a title: lowercase, ASCII-only, spaces to dashes. To normalize a
 * user-typed path (which must keep case, non-ASCII and '/'), use `cleanUrlPath` instead.
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
 * Normalize a user-entered path the way the backend stores it: whitespace to '-', strip unsafe
 * ASCII, collapse/trim dashes — keeping case, non-ASCII and '/'. Mirrors `clean_url_path` (page
 * migration) and `normalize_url_path_for_storage` in pages.rs; keep the three in agreement.
 * Non-destructive for an already-clean path, so blurring it won't rename an existing page.
 */
export const cleanUrlPath = (path: string): string => {
  let decoded = path
  try {
    // A pasted path may be percent-encoded; decode it like the backend does.
    decoded = decodeURIComponent(path)
  } catch {
    // Leave malformed percent sequences as-is.
  }
  // URL_PATH_ENCODE_SET: strips unsafe punctuation/control chars; keeps alphanumerics, '/', '-',
  // '.', '_', '~' and non-ASCII.
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
