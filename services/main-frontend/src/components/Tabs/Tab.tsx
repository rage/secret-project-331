"use client"

import { css } from "@emotion/css"
import { mergeProps } from "@react-aria/utils"
import Link from "next/link"
import React, { useRef } from "react"
import { useFocusRing, useHover, useTab } from "react-aria"

import { useTabsContext } from "./Tabs"

import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface TabProps {
  tabName: string
  children: React.ReactNode
}

const Tab: React.FC<TabProps> = ({ tabName, children }) => {
  const { state, basePath } = useTabsContext()
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

  const href = `${basePath}/${tabName}`

  return (
    <Link
      {...mergeProps(tabProps, focusProps, hoverProps)}
      ref={tabRef}
      href={href}
      replace
      className={css`
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        font-weight: ${isSelected ? fontWeights.semibold : fontWeights.medium};
        font-size: 0.9375rem;
        color: ${isSelected ? baseTheme.colors.green[700] : baseTheme.colors.gray[500]};
        background: ${isSelected ? "#fff" : "transparent"};
        border-radius: 6px;
        padding: 0.625rem 1rem;
        transition: all 0.15s ease;
        position: relative;
        ${isSelected &&
        css`
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.08),
            0 1px 2px rgba(0, 0, 0, 0.06);
        `}
        ${respondToOrLarger.sm} {
          padding: 0.75rem 1.5rem;
          font-size: 0.9375rem;
        }
        ${isFocusVisible &&
        css`
          outline: 2px solid ${baseTheme.colors.green[400]};
          outline-offset: 2px;
        `}
        ${isHovered &&
        !isSelected &&
        css`
          color: ${baseTheme.colors.gray[700]};
          background: rgba(255, 255, 255, 0.5);
        `}
      `}
    >
      {children}
    </Link>
  )
}

export default Tab
