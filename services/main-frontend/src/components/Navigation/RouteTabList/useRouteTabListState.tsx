"use client"

import { Item } from "@react-stately/collections"
import { type TabListState, useTabListState } from "@react-stately/tabs"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { omitUndefined } from "@/shared-module/common/utils/nullability"

import { resolveActiveTab } from "./resolveActiveTab"
import type { RouteTabDefinition } from "./RouteTab"

/**
 * Tab list state for route tabs, with the tab for the current path selected and focusable, so Tab
 * lands on it and the arrow keys move between tabs.
 */
export function useRouteTabListState(tabs: RouteTabDefinition[]): TabListState<object> {
  const pathname = usePathname()
  const selectedKey = useMemo(() => resolveActiveTab(tabs, pathname)?.key, [pathname, tabs])

  return useTabListState<RouteTabDefinition>({
    ...omitUndefined({ selectedKey }),
    ...omitUndefined({ defaultSelectedKey: tabs[0]?.key }),
    items: tabs,
    // Without a collection the selection manager knows no keys, so it can never focus the selected
    // tab and every tab stays at tabindex -1.
    children: (tab) => (
      <Item key={tab.key} textValue={tab.title}>
        {tab.title}
      </Item>
    ),
  }) as TabListState<object>
}
