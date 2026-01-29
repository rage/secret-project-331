"use client"

import { css } from "@emotion/css"
import { useTabListState } from "@react-stately/tabs"
import { usePathname } from "next/navigation"
import React, { useMemo, useRef } from "react"
import { useTabList } from "react-aria"

import { RouteTab, type RouteTabDefinition } from "./RouteTab"
import { useRouteTabListContext } from "./RouteTabListContext"

import { baseTheme } from "@/shared-module/common/styles"

const tabListClassName = css`
  display: flex;
  background: ${baseTheme.colors.gray[75]};
  padding: 4px;
  border-radius: 8px;
  gap: 4px;
  flex-direction: row;
  margin-bottom: 1.5rem;
  border: 1px solid ${baseTheme.colors.gray[100]};
`

const tabListClassNameVertical = css`
  flex-direction: column;
`

export interface RouteTabListProps {
  tabs: RouteTabDefinition[]
  orientation?: "horizontal" | "vertical"
}

function RouteTabListStandalone({ tabs, orientation }: RouteTabListProps) {
  const pathname = usePathname()
  const tabListRef = useRef<HTMLDivElement>(null)

  const selectedKey = useMemo(() => {
    const matched = tabs.find((tab) => pathname.startsWith(tab.href))
    return matched?.key ?? tabs[0]?.key
  }, [pathname, tabs])

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

  const { tabListProps } = useTabList(
    {
      orientation,
      // eslint-disable-next-line i18next/no-literal-string
      "aria-label": "Tabs",
    },
    state,
    tabListRef,
  )

  return (
    <div
      {...tabListProps}
      ref={tabListRef}
      className={`${tabListClassName} ${orientation === "vertical" ? tabListClassNameVertical : ""}`}
    >
      {tabs.map((tab) => (
        <RouteTab key={tab.key} item={tab} state={state} />
      ))}
    </div>
  )
}

function RouteTabListFromContext() {
  const context = useRouteTabListContext()
  const tabListRef = useRef<HTMLDivElement>(null)
  if (!context) {
    throw new Error("RouteTabList must be used with tabs prop or inside RouteTabListProvider")
  }
  const { state, tabs, orientation } = context

  const { tabListProps } = useTabList(
    {
      orientation,
      // eslint-disable-next-line i18next/no-literal-string
      "aria-label": "Tabs",
    },
    state,
    tabListRef,
  )

  return (
    <div
      {...tabListProps}
      ref={tabListRef}
      className={`${tabListClassName} ${orientation === "vertical" ? tabListClassNameVertical : ""}`}
    >
      {tabs.map((tab) => (
        <RouteTab key={tab.key} item={tab} state={state} />
      ))}
    </div>
  )
}

const DEFAULT_ORIENTATION = "horizontal"

/** Renders tab list. Use with tabs prop (standalone) or inside RouteTabListProvider (with RouteTabPanel for full ARIA). */
export const RouteTabList: React.FC<RouteTabListProps> = (props) => {
  const context = useRouteTabListContext()
  if (context !== null) {
    return <RouteTabListFromContext />
  }
  return (
    <RouteTabListStandalone
      tabs={props.tabs}
      orientation={props.orientation ?? DEFAULT_ORIENTATION}
    />
  )
}
