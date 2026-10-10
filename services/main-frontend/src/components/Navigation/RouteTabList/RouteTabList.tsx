"use client"

import React from "react"

import { TabStrip } from "@/components/Tabs/tabStrip"

import { RouteTab, type RouteTabDefinition } from "./RouteTab"
import { useRouteTabListContext } from "./RouteTabListContext"
import { useRouteTabListState } from "./useRouteTabListState"

const DEFAULT_ORIENTATION = "horizontal"

export interface RouteTabListProps {
  tabs?: RouteTabDefinition[]
  orientation?: "horizontal" | "vertical"
  /** Span the container and share the width between the tabs; for a page's primary navigation. */
  fullWidth?: boolean
  /** Composed after the built-in styles, so a layout can override the tab list's own spacing. */
  className?: string | undefined
}

function RouteTabListStandalone({
  tabs,
  orientation,
  fullWidth,
  className,
}: Omit<RouteTabListProps, "orientation" | "tabs"> & {
  tabs: RouteTabDefinition[]
  orientation: "horizontal" | "vertical"
}) {
  const state = useRouteTabListState(tabs)

  return (
    <TabStrip
      state={state}
      orientation={orientation}
      selectedKey={state.selectedKey}
      fullWidth={fullWidth ?? false}
      className={className}
    >
      {tabs.map((tab) => (
        <RouteTab key={tab.key} item={tab} state={state} />
      ))}
    </TabStrip>
  )
}

function RouteTabListFromContext({
  fullWidth,
  className,
}: Pick<RouteTabListProps, "fullWidth" | "className">) {
  const context = useRouteTabListContext()
  if (!context) {
    throw new Error("RouteTabList must be used with tabs prop or inside RouteTabListProvider")
  }
  const { state, tabs, orientation } = context

  return (
    <TabStrip
      state={state}
      orientation={orientation}
      selectedKey={state.selectedKey}
      fullWidth={fullWidth ?? false}
      className={className}
    >
      {tabs.map((tab) => (
        <RouteTab key={tab.key} item={tab} state={state} />
      ))}
    </TabStrip>
  )
}

/** Renders tab list. Use with tabs prop (standalone) or inside RouteTabListProvider (with RouteTabPanel for full ARIA). */
export const RouteTabList: React.FC<RouteTabListProps> = (props) => {
  const context = useRouteTabListContext()
  if (props.tabs) {
    return (
      <RouteTabListStandalone
        tabs={props.tabs}
        orientation={props.orientation ?? DEFAULT_ORIENTATION}
        fullWidth={props.fullWidth ?? false}
        className={props.className}
      />
    )
  }
  if (context !== null) {
    return (
      <RouteTabListFromContext fullWidth={props.fullWidth ?? false} className={props.className} />
    )
  }
  throw new Error("RouteTabList requires either tabs prop or RouteTabListProvider context")
}
