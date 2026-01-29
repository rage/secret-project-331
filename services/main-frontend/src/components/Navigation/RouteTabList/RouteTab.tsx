"use client"

import { css } from "@emotion/css"
import { mergeProps } from "@react-aria/utils"
import type { TabListState } from "@react-stately/tabs"
import type { UseQueryResult } from "@tanstack/react-query"
import Link from "next/link"
import React, { useRef } from "react"
import { useFocusRing, useHover, useTab } from "react-aria"

import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface RouteTabDefinition {
  key: string
  title: string
  href: string
  disabled?: boolean
  countHook?: () => UseQueryResult<number, unknown>
}

interface RouteTabProps {
  item: RouteTabDefinition
  state: TabListState<object>
}

export const RouteTab: React.FC<RouteTabProps> = ({ item, state }) => {
  const ref = useRef<HTMLAnchorElement>(null)

  const { tabProps, isSelected, isDisabled } = useTab(
    {
      key: item.key,
      isDisabled: item.disabled,
    },
    state,
    ref,
  )

  const { focusProps, isFocusVisible } = useFocusRing()
  const { hoverProps, isHovered } = useHover({})

  const count = item.countHook?.()

  if (count?.isError) {
    console.error("Could not fetch count:", count.error)
  }

  const { "aria-controls": _ariaControls, ...restTabProps } = tabProps

  return (
    <Link
      {...mergeProps(restTabProps, focusProps, hoverProps)}
      ref={ref}
      href={item.href}
      replace
      aria-disabled={isDisabled}
      className={css`
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        font-weight: ${isSelected ? fontWeights.semibold : fontWeights.medium};
        font-size: 0.9375rem;
        color: ${isDisabled
          ? baseTheme.colors.gray[300]
          : isSelected
            ? baseTheme.colors.green[700]
            : baseTheme.colors.gray[500]};
        background: ${isSelected ? "#fff" : "transparent"};
        border-radius: 6px;
        padding: 0.625rem 1rem;
        transition: all 0.15s ease;
        position: relative;
        cursor: ${isDisabled ? "not-allowed" : "pointer"};
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
        !isDisabled &&
        css`
          color: ${baseTheme.colors.gray[700]};
          background: rgba(255, 255, 255, 0.5);
        `}
      `}
    >
      <span>{item.title}</span>
      {count?.isLoading && (
        <span
          className={css`
            margin-left: 6px;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid ${baseTheme.colors.red[400]};
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
            background: ${baseTheme.colors.red[400]};
            border-radius: 20px;
            line-height: 10px;
            padding: 1px 5px;
            text-align: center;
            font-size: 14px;
            color: ${baseTheme.colors.primary[100]};
            margin-left: 3px;
            width: 20px;
            height: 20px;
          `}
        >
          {count.data}
        </span>
      )}
    </Link>
  )
}
