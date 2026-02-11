"use client"

import { css } from "@emotion/css"
import { TabListState, useTabListState } from "@react-stately/tabs"
import { usePathname, useRouter } from "next/navigation"
import React, { createContext, useContext, useMemo, useRef } from "react"
import { useTabList } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface TabsContextValue {
  state: TabListState<object>
  basePath: string
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
  const { t } = useTranslation()
  const tabListRef = useRef<HTMLDivElement>(null)

  const basePath = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length >= 1) {
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

  const selectedKey = useMemo(() => {
    const currentSegment = pathname.split("/").filter(Boolean)[1]
    return currentSegment && tabNames.includes(currentSegment)
      ? currentSegment
      : (tabNames[0] ?? null)
  }, [pathname, tabNames])

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
    selectedKey: selectedKey ?? undefined,
    defaultSelectedKey: tabNames[0] ?? undefined,
    items,
    onSelectionChange: (key) => {
      router.replace(`${basePath}/${String(key)}`)
    },
  })

  const { tabListProps } = useTabList(
    {
      orientation,
      "aria-label": t("tab-aria-label-default"),
    },
    state,
    tabListRef,
  )

  return (
    <TabsContext.Provider value={{ state, basePath }}>
      <div
        {...tabListProps}
        ref={tabListRef}
        className={css`
          display: flex;
          background: ${baseTheme.colors.gray[75]};
          padding: 4px;
          border-radius: 8px;
          gap: 4px;
          flex-direction: ${orientation === "horizontal" ? "row" : "column"};
          margin-bottom: 1.5rem;
          border: 1px solid ${baseTheme.colors.gray[100]};
        `}
      >
        {tabChildren}
      </div>
      {panelChildren}
    </TabsContext.Provider>
  )
}

export default Tabs
