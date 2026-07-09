"use client"

import { type TabListState, useTabListState } from "@react-stately/tabs"
import { usePathname } from "next/navigation"
import React, { createContext, useContext, useMemo } from "react"

import type { RouteTabDefinition } from "./RouteTab"
import { resolveActiveTab } from "./resolveActiveTab"

interface RouteTabListContextValue {
  state: TabListState<object>
  tabs: RouteTabDefinition[]
  orientation: "horizontal" | "vertical"
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

  const selectedKey = useMemo(() => resolveActiveTab(tabs, pathname)?.key, [pathname, tabs])

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
    selectedKey,
    defaultSelectedKey: tabs[0]?.key,
    items,
  })

  const value = useMemo(() => ({ state, tabs, orientation }), [state, tabs, orientation])

  return <RouteTabListContext.Provider value={value}>{children}</RouteTabListContext.Provider>
}
