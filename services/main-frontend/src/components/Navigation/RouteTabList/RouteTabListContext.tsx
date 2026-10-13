"use client"

import type { TabListState } from "@react-stately/tabs"
import React, { createContext, useContext, useMemo } from "react"

import type { RouteTabDefinition } from "./RouteTab"
import { useRouteTabListState } from "./useRouteTabListState"

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
  const state = useRouteTabListState(tabs)

  const value = useMemo(() => ({ state, tabs, orientation }), [state, tabs, orientation])

  return <RouteTabListContext.Provider value={value}>{children}</RouteTabListContext.Provider>
}
