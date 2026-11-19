"use client"

import type { TabListState } from "@react-stately/tabs"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { useFocusableTabListState } from "@/components/Tabs/useFocusableTabListState"

import { resolveActiveTab } from "./resolveActiveTab"
import type { RouteTabDefinition } from "./RouteTab"

interface RouteTabListState {
  state: TabListState<object>
  /** False when the route matches no tab, so `RouteTab` can avoid painting one as current. */
  isCurrentRouteATab: boolean
}

/** Tab list state for route tabs, with the tab for the current path selected. */
export function useRouteTabListState(tabs: RouteTabDefinition[]): RouteTabListState {
  const pathname = usePathname()
  // Resolved without the fallback so a route with no matching tab can be told apart from one that
  // genuinely matches the first tab; react-stately still needs some key selected for keyboard use.
  const matchedTab = useMemo(() => resolveActiveTab(tabs, pathname, false), [pathname, tabs])
  const state = useFocusableTabListState(tabs, matchedTab?.key ?? tabs[0]?.key)
  return { state, isCurrentRouteATab: matchedTab !== undefined }
}
