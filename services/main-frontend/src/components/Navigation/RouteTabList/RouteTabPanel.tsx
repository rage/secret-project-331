"use client"

import React, { useRef } from "react"
import { useTabPanel } from "react-aria"

import { useRouteTabListContext } from "./RouteTabListContext"

interface RouteTabPanelProps {
  children: React.ReactNode
}

function RouteTabPanelWithContext({ children }: RouteTabPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const context = useRouteTabListContext()
  if (!context) {
    throw new Error("RouteTabPanelWithContext must be used within RouteTabListProvider")
  }
  const { tabPanelProps } = useTabPanel({}, context.state, ref)
  return (
    <div {...tabPanelProps} ref={ref}>
      {children}
    </div>
  )
}

/** Wrapper for tab content. Uses useTabPanel when inside RouteTabListProvider for full ARIA semantics and focus management. */
export const RouteTabPanel: React.FC<RouteTabPanelProps> = ({ children }) => {
  const context = useRouteTabListContext()

  if (context !== null) {
    return <RouteTabPanelWithContext>{children}</RouteTabPanelWithContext>
  }

  return (
    <div role="tabpanel" tabIndex={0}>
      {children}
    </div>
  )
}
