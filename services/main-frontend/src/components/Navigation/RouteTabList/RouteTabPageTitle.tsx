"use client"

import { usePathname } from "next/navigation"
import type React from "react"

import type { RouteTabDefinition } from "./RouteTab"
import { resolveActiveTab } from "./resolveActiveTab"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"

interface RouteTabPageTitleProps {
  tabs: RouteTabDefinition[]
  entityName: string | null | undefined
  order?: number
}

/**
 * Sets the page title to `"{active tab title} - {entityName}"` for a tabbed layout, e.g.
 * `"Students - Programming 101"`. Renders nothing.
 *
 * Takes `tabs` as a prop and resolves the active tab itself (via the pathname) rather than
 * reading `useRouteTabListContext()`, because most tabbed layouts render `RouteTabList` in
 * standalone mode where that context is absent. The tab titles are already localized.
 */
export const RouteTabPageTitle: React.FC<RouteTabPageTitleProps> = ({
  tabs,
  entityName,
  order,
}) => {
  const pathname = usePathname()
  // Do not fall back to the first tab: on a sub-route with no tab of its own (e.g.
  // /manage/courses/{id}/user-status-summary/{id}), we want the title to be the entity name
  // alone, not a misleading "{first tab} - {entity}".
  const activeTab = resolveActiveTab(tabs, pathname, false)
  usePageTitle(joinTitleSegments([activeTab?.title, entityName]), { order })
  return null
}
