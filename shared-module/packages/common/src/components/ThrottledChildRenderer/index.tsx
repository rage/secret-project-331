"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useEverTrue } from "../../hooks/useEverTrue"
import {
  type LoadSlotConfig,
  NEAR_VIEWPORT_ROOT_MARGIN,
  useLoadSlot,
} from "../../hooks/useLoadSlot"
import { baseTheme } from "../../styles"
import Spinner from "../Spinner"

/** Call `onReady` once the child has loaded; until then, or until the hold timeout, it holds a load slot. */
export type ChildFactoryWithCallback = (onReady: () => void) => React.ReactNode

interface ThrottledChildRendererProps {
  /** Queue shared by every renderer on the page that should be throttled together. */
  qid: string
  id: string
  children: React.ReactNode | ChildFactoryWithCallback
  rootMargin?: string
  placeholder?: React.ReactNode
  minPlaceholderHeight?: number
  queueConfig?: Partial<LoadSlotConfig>
}

/**
 * Renders `children` once the `qid` queue grants a load slot and keeps them rendered from then on.
 * Plain `children` hold the slot until the hold timeout; pass a factory to release it on ready.
 */
export function ThrottledChildRenderer({
  qid,
  id,
  children,
  rootMargin = NEAR_VIEWPORT_ROOT_MARGIN,
  placeholder,
  minPlaceholderHeight = 200,
  queueConfig,
}: ThrottledChildRendererProps) {
  const { t } = useTranslation()
  const { ref, status, release } = useLoadSlot(qid, queueConfig, rootMargin)
  const hasStarted = useEverTrue(status !== "waiting")

  const content = useMemo(
    () => (typeof children === "function" ? children(release) : children),
    [children, release],
  )

  return (
    <div ref={ref} data-testid={`throttled-renderer-${id}`}>
      {hasStarted
        ? content
        : (placeholder ?? (
            <div
              className={css`
                min-height: ${minPlaceholderHeight}px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                border: 1px dashed ${baseTheme.colors.gray[200]};
                border-radius: 4px;
                color: ${baseTheme.colors.gray[500]};
              `}
            >
              <Spinner variant="small" disableMargin />
              {t("throttled-renderer.loading")}
            </div>
          ))}
    </div>
  )
}

export default ThrottledChildRenderer
