"use client"

import { type TabListState, useTabListState } from "@react-stately/tabs"
import { usePathname } from "next/navigation"
import React, { createContext, useContext, useMemo } from "react"

import { omitUndefined } from "@/shared-module/common/utils/nullability"

import { resolveActiveTab } from "./resolveActiveTab"
import type { RouteTabDefinition } from "./RouteTab"

interface RouteTabListContextValue {
  state: TabListState<object>
  tabs: RouteTabDefinition[]
  orientation: "horizontal" | "vertical"
  /** False when the route matches no tab, so `RouteTab` can avoid painting one as current. */
  isCurrentRouteATab: boolean
}

const RouteTabListContext = createContext<RouteTabListContextValue | null>(null)

export function useRouteTabListContext(): RouteTabListContextValue | null {
  return useContext(RouteTabListContext)
}

export interface RouteTabListProviderProps {
  tabs: RouteTabDefinition[]
  orientation?: "horizontal" | "vertical"
  children: React.ReactNode
}

/** Provides tab list state so RouteTabList and RouteTabPanel can use React Aria hooks with full ARIA semantics. */
export function RouteTabListProvider({
  tabs,
  orientation = "horizontal",
  children,
}: RouteTabListProviderProps) {
  const pathname = usePathname()

  // Resolved without the fallback so a route with no matching tab can be told apart from one that
  // genuinely matches the first tab; react-stately still needs some key selected for keyboard use.
  const matchedTab = useMemo(() => resolveActiveTab(tabs, pathname, false), [pathname, tabs])
  const isCurrentRouteATab = matchedTab !== undefined
  const selectedKey = matchedTab?.key ?? tabs[0]?.key

  const items = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab.key,
        id: tab.key,
        textValue: tab.title,
      })),
    [tabs],
  )

  const state = useTabListState({
    ...omitUndefined({ selectedKey }),
    ...omitUndefined({ defaultSelectedKey: tabs[0]?.key }),
    items,
  })

  const value = useMemo(
    () => ({ state, tabs, orientation, isCurrentRouteATab }),
    [state, tabs, orientation, isCurrentRouteATab],
  )

  return <RouteTabListContext.Provider value={value}>{children}</RouteTabListContext.Provider>
}
