"use client"

import { css, cx } from "@emotion/css"
import { mergeProps } from "@react-aria/utils"
import Link from "next/link"
import React, { useRef } from "react"
import { useFocusRing, useHover, useTab } from "react-aria"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

import { useTabsContext } from "./Tabs"
import { tabPillCss } from "./tabStrip"

interface TabProps {
  tabName: string
  children: React.ReactNode
}

const Tab: React.FC<TabProps> = ({ tabName, children }) => {
  const { state, basePath, isCurrentRouteATab } = useTabsContext()
  const tabRef = useRef<HTMLAnchorElement>(null)

  const { tabProps, isSelected } = useTab(
    {
      key: tabName,
    },
    state,
    tabRef,
  )

  const { focusProps, isFocusVisible } = useFocusRing()
  const { hoverProps, isHovered } = useHover({})

  const isCurrent = isSelected && isCurrentRouteATab
  const href = `${basePath}/${tabName}`

  const { "aria-controls": _ariaControls, ...restTabProps } = tabProps

  return (
    // @ts-expect-error -- mergeProps' `handler | undefined` event handlers are rejected by Next LinkProps under exactOptionalPropertyTypes; safe at runtime
    <Link
      {...mergeProps(restTabProps, focusProps, hoverProps)}
      aria-selected={isCurrent}
      ref={tabRef}
      href={href}
      replace
      className={cx(
        tabPillCss({ isSelected: isCurrent, isFocusVisible, isHovered }),
        css`
          font-size: 0.9375rem;
          ${respondToOrLarger.sm} {
            padding: 0.75rem 1.5rem;
          }
        `,
      )}
    >
      {children}
    </Link>
  )
}

export default Tab
