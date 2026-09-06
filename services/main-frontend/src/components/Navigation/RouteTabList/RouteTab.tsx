"use client"

import { css, cx } from "@emotion/css"
import { mergeProps } from "@react-aria/utils"
import type { TabListState } from "@react-stately/tabs"
import type { UseQueryResult } from "@tanstack/react-query"
import Link from "next/link"
import React, { useRef } from "react"
import { useFocusRing, useHover, useTab } from "react-aria"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"

import { tabPillCss } from "../../Tabs/tabStrip"

/** How loud a tab's count is: `danger` is for a backlog someone has to work through. */
export type RouteTabCountTone = "neutral" | "danger"

export interface RouteTabDefinition {
  key: string
  title: string
  href: string
  /** If set, used for active-tab matching (pathname.startsWith). Omit to use href. */
  pathPrefix?: string
  disabled?: boolean
  countHook?: () => UseQueryResult<number, unknown>
  /**
   * Tone for the badge `countHook` fills. Defaults to neutral, because only the surface knows
   * which of its counts is urgent, and a strip where every count is red ranks nothing.
   */
  countTone?: RouteTabCountTone
}

const COUNT_TONE = {
  neutral: {
    background: baseTheme.colors.gray[100],
    text: baseTheme.colors.gray[700],
    spinner: baseTheme.colors.gray[400],
  },
  danger: {
    background: baseTheme.colors.red[600],
    text: baseTheme.colors.primary[100],
    spinner: baseTheme.colors.red[400],
  },
} satisfies Record<RouteTabCountTone, { background: string; text: string; spinner: string }>

interface RouteTabProps {
  item: RouteTabDefinition
  state: TabListState<object>
}

export const RouteTab: React.FC<RouteTabProps> = ({ item, state }) => {
  const ref = useRef<HTMLAnchorElement>(null)

  const { tabProps, isSelected, isDisabled } = useTab(
    {
      key: item.key,
      ...omitUndefined({ isDisabled: item.disabled }),
    },
    state,
    ref,
  )

  const { focusProps, isFocusVisible } = useFocusRing()
  const { hoverProps, isHovered } = useHover({})

  const count = item.countHook?.()
  const countTone = item.countTone === undefined ? COUNT_TONE.neutral : COUNT_TONE[item.countTone]

  if (count?.isError) {
    console.error("Could not fetch count:", count.error)
  }

  const { "aria-controls": _ariaControls, ...restTabProps } = tabProps
  // next/link declares onMouseEnter/onClick/onTouchStart as optional but without `undefined`, so
  // under exactOptionalPropertyTypes they cannot receive the possibly-undefined handlers that
  // mergeProps produces. Pull them out and only spread them back when actually defined.
  const { onMouseEnter, onClick, onTouchStart, ...linkProps } = mergeProps(
    restTabProps,
    focusProps,
    hoverProps,
  )

  return (
    <Link
      {...linkProps}
      {...includeIf(onMouseEnter, { onMouseEnter })}
      {...includeIf(onClick, { onClick })}
      {...includeIf(onTouchStart, { onTouchStart })}
      ref={ref}
      href={item.href}
      replace
      aria-disabled={isDisabled}
      className={cx(
        tabPillCss({ isSelected, isFocusVisible, isHovered, isDisabled }),
        css`
          font-size: 0.875rem;
          ${respondToOrLarger.sm} {
            padding: 0.625rem 1.125rem;
            font-size: 0.9rem;
          }
        `,
      )}
    >
      <span>{item.title}</span>
      {count?.isLoading && (
        <span
          className={css`
            margin-left: 6px;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid ${countTone.spinner};
            border-top-color: transparent;
            animation: spin 0.8s linear infinite;

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        />
      )}
      {count?.isSuccess && count.data !== 0 && (
        <span
          className={css`
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            min-height: 20px;
            box-sizing: border-box;
            background: ${countTone.background};
            border-radius: 20px;
            font-size: 12px;
            color: ${countTone.text};
            margin-left: 3px;
            padding: 0 6px;
          `}
        >
          {count.data}
        </span>
      )}
    </Link>
  )
}
