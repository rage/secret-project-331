"use client"

import type { TabListState } from "@react-stately/tabs"
import React, { createContext, useContext, useMemo } from "react"

import type { RouteTabDefinition } from "./RouteTab"
import { useRouteTabListState } from "./useRouteTabListState"

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
  const { state, isCurrentRouteATab } = useRouteTabListState(tabs)

  const value = useMemo(
    () => ({ state, tabs, orientation, isCurrentRouteATab }),
    [state, tabs, orientation, isCurrentRouteATab],
  )

  return <RouteTabListContext.Provider value={value}>{children}</RouteTabListContext.Provider>
}
