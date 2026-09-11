"use client"

import type { TabListState } from "@react-stately/tabs"
import { useTabListState } from "@react-stately/tabs"
import { usePathname, useRouter } from "next/navigation"
import React, { createContext, useContext, useMemo } from "react"

import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"

import { TabStrip } from "./tabStrip"

interface TabsContextValue {
  state: TabListState<object>
  basePath: string
  /**
   * False on a route with no tab of its own, where the tab list would otherwise paint its first
   * tab as the current one and tell the reader they are somewhere they are not.
   */
  isCurrentRouteATab: boolean
}

const TabsContext = createContext<TabsContextValue | null>(null)

export const useTabsContext = () => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error("Tab components must be used within a Tabs container")
  }
  return context
}

interface TabsProps {
  children: React.ReactNode
  orientation?: "horizontal" | "vertical"
}

const Tabs: React.FC<TabsProps> = ({ children, orientation = "horizontal" }) => {
  const pathname = usePathname()
  const router = useRouter()

  const basePath = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length > 0) {
      return `/${segments[0]}`
    }
    return pathname.replace(/\/$/, "") || "/"
  }, [pathname])

  const { tabChildren, panelChildren } = useMemo(() => {
    const tabs: React.ReactElement[] = []
    const panels: React.ReactElement[] = []

    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        if (typeof child.props === "object" && child.props !== null && "tabName" in child.props) {
          tabs.push(child)
        } else {
          panels.push(child)
        }
      }
    })

    return { tabChildren: tabs, panelChildren: panels }
  }, [children])

  const tabNames = useMemo(() => {
    return tabChildren
      .filter((child): child is React.ReactElement<{ tabName: string }> => {
        return (
          React.isValidElement(child) &&
          typeof child.props === "object" &&
          child.props !== null &&
          "tabName" in child.props
        )
      })
      .map((child) => {
        const props = child.props as { tabName: string }
        return props.tabName
      })
  }, [tabChildren])

  const currentTab = useMemo(() => {
    const segment = pathname.split("/").filter(Boolean)[1]
    return segment !== undefined && tabNames.includes(segment) ? segment : undefined
  }, [pathname, tabNames])

  // react-stately insists on a selected tab, so a route with none of its own still resolves to
  // the first for keyboard entry; the context flag is what keeps that off the screen.
  const selectedKey = currentTab ?? tabNames[0] ?? null

  const items = useMemo(
    () =>
      tabNames.map((name) => ({
        key: name,
        id: name,
        textValue: name,
      })),
    [tabNames],
  )

  const state = useTabListState({
    ...includeIf(selectedKey !== null, { selectedKey }),
    ...omitUndefined({ defaultSelectedKey: tabNames[0] }),
    items,
    onSelectionChange: (key) => {
      router.replace(`${basePath}/${String(key)}`)
    },
  })

  return (
    <TabsContext.Provider value={{ state, basePath, isCurrentRouteATab: currentTab !== undefined }}>
      <TabStrip state={state} orientation={orientation} selectedKey={selectedKey}>
        {tabChildren}
      </TabStrip>
      {panelChildren}
    </TabsContext.Provider>
  )
}

export default Tabs
