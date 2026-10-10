"use client"

import type { TabListState } from "@react-stately/tabs"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { useFocusableTabListState } from "@/components/Tabs/useFocusableTabListState"

import { resolveActiveTab } from "./resolveActiveTab"
import type { RouteTabDefinition } from "./RouteTab"

/** Tab list state for route tabs, with the tab for the current path selected. */
export function useRouteTabListState(tabs: RouteTabDefinition[]): TabListState<object> {
  const pathname = usePathname()
  const selectedKey = useMemo(() => resolveActiveTab(tabs, pathname)?.key, [pathname, tabs])
  return useFocusableTabListState(tabs, selectedKey)
}
