import type { RouteTabDefinition } from "./RouteTab"

/**
 * Resolves which tab is active for a given pathname. A tab matches when its match path
 * (`pathPrefix ?? href`) is a prefix of the pathname; the longest matching prefix wins.
 * Falls back to the first tab when nothing matches.
 */
export function resolveActiveTab(
  tabs: RouteTabDefinition[],
  pathname: string,
): RouteTabDefinition | undefined {
  const matchPath = (tab: RouteTabDefinition) => tab.pathPrefix ?? tab.href
  const matching = tabs.filter((tab) => pathname.startsWith(matchPath(tab)))
  if (matching.length === 0) {
    return tabs[0]
  }
  return matching.reduce((a, b) => (matchPath(a).length >= matchPath(b).length ? a : b))
}
