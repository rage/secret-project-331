"use client"

import React from "react"

import type { ErrorNoticeAnnouncement } from "@/shared-module/components/components/ErrorNotice"
import { ErrorNotice } from "@/shared-module/components/components/ErrorNotice"

import { omitUndefined } from "../../utils/nullability"

const FRONTEND_CRASH_VARIANT = "frontendCrash"
const COMPACT_DENSITY = "compact"
const COMFORTABLE_DENSITY = "comfortable"

export interface BannerExtraProps {
  error: unknown
  /** Legacy styling switch. Only `frontendCrash` still changes anything; it tightens the layout. */
  variant?: "text" | "link" | "readOnly" | "frontendCrash"
  contextMessage?: React.ReactNode
  maxHeightVH?: number
  listMaxHeightVH?: number
  /** See `ErrorNotice`; defaults to a polite announcement. */
  announce?: ErrorNoticeAnnouncement
  className?: string
}

export type BannerProps = BannerExtraProps

/**
 * `ErrorNotice` under the prop names its existing call sites already pass. New code should use
 * `ErrorNotice` from the components package directly.
 */
const ErrorBanner: React.FC<BannerProps> = ({
  error,
  variant = "text",
  contextMessage,
  maxHeightVH,
  listMaxHeightVH,
  announce,
  className,
}) => (
  <ErrorNotice
    error={error}
    density={variant === FRONTEND_CRASH_VARIANT ? COMPACT_DENSITY : COMFORTABLE_DENSITY}
    {...omitUndefined({
      context: contextMessage,
      announce,
      className,
      maxHeight: maxHeightVH === undefined ? undefined : `${maxHeightVH}vh`,
      detailsMaxHeight: listMaxHeightVH === undefined ? undefined : `${listMaxHeightVH}vh`,
    })}
  />
)

export default ErrorBanner
