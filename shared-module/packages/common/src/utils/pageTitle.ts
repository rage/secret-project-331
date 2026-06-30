/**
 * Default site/brand name used as the suffix of every page title, e.g. "Page name - Site name".
 * This is a brand name, not user-facing copy, so it is intentionally not translated.
 * Reads `NEXT_PUBLIC_SITE_TITLE` so deployments can rebrand; falls back to the project name.
 */
export const DEFAULT_SITE_NAME = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331"

/**
 * Builds a professional, consistently formatted document title.
 *
 * - With a non-blank page title: `"{pageTitle}{separator}{siteName}"` (e.g. "Settings - Site").
 * - With a blank/missing page title: just `siteName` (e.g. the landing/default tab).
 *
 * Pure and SSR-safe (does not touch `document`). The page title is expected to already be
 * localized by the caller (e.g. `formatPageTitle(t("settings-title"), siteName)`).
 */
export function formatPageTitle(
  pageTitle: string | null | undefined,
  siteName: string,
  separator = " - ",
): string {
  const trimmed = pageTitle?.trim()
  if (!trimmed) {
    return siteName
  }
  return `${trimmed}${separator}${siteName}`
}
