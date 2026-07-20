/**
 * Build a URL slug from a title: lowercase, ASCII-only, spaces to dashes. To normalize a
 * user-typed path (which must keep case, non-ASCII and '/'), use `cleanUrlPath` instead.
 */
export const normalizePath = (str: string): string => {
  return str
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-z0-9-]/g, "")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

/**
 * Normalize a user-entered path the way the backend stores it: whitespace to '-', strip unsafe
 * ASCII, collapse/trim dashes — keeping case, non-ASCII and '/'. Mirrors `clean_url_path` (page
 * migration) and `normalize_url_path_for_storage` in pages.rs; keep the three in agreement.
 * Non-destructive for an already-clean path, so blurring it won't rename an existing page.
 */
export const cleanUrlPath = (path: string): string => {
  // Decode each maximal run of %XX escapes as one unit, dropping a run that isn't valid UTF-8
  // (instead of failing the whole string). Matches decode_percent_runs in pages.rs.
  const decoded = path.replaceAll(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run)
    } catch {
      return ""
    }
  })
  // Strip unsafe ASCII (URL_PATH_ENCODE_SET); keep alphanumerics, '/', '-', '.', '_', '~', non-ASCII.
  // oxlint-disable-next-line no-control-regex
  const unsafeAscii = /[\u0000-\u002C\u003A-\u0040\u005B-\u005E\u0060\u007B-\u007D\u007F]/g
  return decoded
    .replaceAll(/\s+/g, "-")
    .replace(unsafeAscii, "")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/-+\//g, "/")
    .replaceAll(/\/-+/g, "/")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}
