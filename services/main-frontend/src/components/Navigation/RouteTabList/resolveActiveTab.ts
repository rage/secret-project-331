import type { RouteTabDefinition } from "./RouteTab"

/**
 * Resolves which tab is active for a given pathname. A tab matches when its match path
 * (`pathPrefix ?? href`) equals the pathname or is a path-segment prefix of it (so `/foo` matches
 * `/foo` and `/foo/bar` but not a sibling `/foobar`); the longest matching prefix wins.
 *
 * When nothing matches, `fallbackToFirst` (default) returns the first tab — the right choice for
 * highlighting a tab list, which always wants some tab selected. Pass `false` when a non-match
 * should mean "no active tab" (e.g. deriving a page title on a sub-route that has no tab of its
 * own, where falling back to the first tab would mislabel the page).
 */
export function resolveActiveTab(
  tabs: RouteTabDefinition[],
  pathname: string,
  fallbackToFirst = true,
): RouteTabDefinition | undefined {
  const matchPath = (tab: RouteTabDefinition) => tab.pathPrefix ?? tab.href
  const isMatch = (tab: RouteTabDefinition) => {
    const mp = matchPath(tab)
    return pathname === mp || pathname.startsWith(mp.endsWith("/") ? mp : `${mp}/`)
  }
  const matching = tabs.filter(isMatch)
  if (matching.length === 0) {
    return fallbackToFirst ? tabs[0] : undefined
  }
  return matching.reduce((a, b) => (matchPath(a).length >= matchPath(b).length ? a : b))
}
