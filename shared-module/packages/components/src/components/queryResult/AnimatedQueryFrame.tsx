"use client"

import { cx } from "@emotion/css"
import { motion } from "motion/react"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "../Button"

import type { RetryFn } from "./queryResultState"
import { getErrorMessage } from "./queryResultState"
import {
  animatedContentCss,
  animatedContentRefreshingCss,
  bannerCss,
  blockingErrorCss,
  errorStackCss,
  errorTextCss,
  initialLoadingCenterCss,
  initialLoadingSurfaceCss,
  initialLoadingSurfaceDarkCss,
  initialLoadingSurfaceLightCss,
  loadingSurfaceMinHeightCss,
  queryLoadingSpinnerCss,
  skeletonBlockBaseCss,
  skeletonBlockDarkCss,
  skeletonBlockDimsCss,
  skeletonBlockLightCss,
  skeletonBlocksCss,
  staleStatusCss,
  surfaceFrameCss,
  type ThemeMode,
  topProgressCss,
  topProgressTrackDarkCss,
  topProgressTrackLightCss,
  wrapperCss,
} from "./queryResultStyles"

export type FallbackArgs<E> = {
  error: E
  retry: RetryFn
}

const skeletonPresets = [
  { width: "55%", height: 14 },
  { width: "100%", height: 22 },
  { width: "72%", height: 14 },
] as const

const contentEntranceEase = [0.2, 0, 0, 1] as const

/** Delays showing an affordance (e.g. centered spinner) to avoid flashes on fast requests. */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const t = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(t)
  }, [active, delayMs])

  return visible
}

export type AnimatedQueryFrameProps<E> = {
  themeMode: ThemeMode
  minHeight?: number
  loadingDelayMs?: number
  initialLoading: boolean
  refreshing: boolean
  blockingError: boolean
  staleError: boolean
  error?: E
  retry: RetryFn
  children: React.ReactNode
  renderBlockingError?: (args: FallbackArgs<E>) => React.ReactNode
  renderStaleError?: (args: FallbackArgs<E>) => React.ReactNode
}

/** Default blocking-error UI with retry. */
export function DefaultBlockingError<E>({ error, retry }: FallbackArgs<E>) {
  const { t } = useTranslation()
  return (
    <div className={blockingErrorCss} role="alert">
      <div className={errorStackCss}>
        <p className={errorTextCss}>{getErrorMessage(error)}</p>
        <Button type="button" variant="secondary" size="small" onPress={retry}>
          {t("queryResult.retry")}
        </Button>
      </div>
    </div>
  )
}

/** Inline stale-error notice with retry (content still renders below). */
export function DefaultStaleError<E>({ error, retry }: FallbackArgs<E>) {
  const { t } = useTranslation()
  return (
    <div className={errorStackCss}>
      <div className={staleStatusCss} role="status">
        {getErrorMessage(error)}
      </div>
      <Button type="button" variant="tertiary" size="small" onPress={retry}>
        {t("queryResult.retry")}
      </Button>
    </div>
  )
}

/** Layout shell for async query UX: skeleton, refetch progress, stale banners, and motion. */
export function AnimatedQueryFrame<E>({
  themeMode,
  minHeight = 160,
  loadingDelayMs = 200,
  initialLoading,
  refreshing,
  blockingError,
  staleError,
  error,
  retry,
  children,
  renderBlockingError,
  renderStaleError,
}: AnimatedQueryFrameProps<E>) {
  const { t } = useTranslation()
  const showDelayedSpinner = useDelayedFlag(initialLoading, loadingDelayMs)
  const surfaceThemeCss =
    themeMode === "dark" ? initialLoadingSurfaceDarkCss : initialLoadingSurfaceLightCss
  const skeletonToneCss = themeMode === "dark" ? skeletonBlockDarkCss : skeletonBlockLightCss
  const progressTrackCss = themeMode === "dark" ? topProgressTrackDarkCss : topProgressTrackLightCss

  if (blockingError && error !== undefined) {
    const args = { error, retry }
    return renderBlockingError ? renderBlockingError(args) : <DefaultBlockingError {...args} />
  }

  if (initialLoading) {
    const loadingLabel = t("queryResult.loading")
    return (
      <section
        className={wrapperCss}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={loadingLabel}
        data-testid="query-initial-loading"
      >
        <div
          className={cx(
            initialLoadingSurfaceCss,
            surfaceThemeCss,
            loadingSurfaceMinHeightCss(minHeight),
          )}
        >
          <div className={skeletonBlocksCss} data-testid="query-skeleton-blocks">
            {skeletonPresets.map((preset, index) => (
              <div
                key={index}
                className={cx(
                  skeletonBlockBaseCss,
                  skeletonToneCss,
                  skeletonBlockDimsCss(preset.width, preset.height),
                )}
              />
            ))}
          </div>
          {showDelayedSpinner ? (
            <motion.div
              className={initialLoadingCenterCss}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={queryLoadingSpinnerCss}
                data-testid="query-loading-spinner"
                aria-hidden
              />
            </motion.div>
          ) : null}
        </div>
      </section>
    )
  }

  const staleArgs = staleError && error !== undefined ? { error, retry } : undefined

  return (
    <section className={wrapperCss} aria-busy={refreshing ? "true" : undefined}>
      {refreshing ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("queryResult.refreshing")}
          data-testid="query-refreshing-status"
        />
      ) : null}
      <div className={surfaceFrameCss}>
        {refreshing ? <div className={cx(topProgressCss, progressTrackCss)} aria-hidden /> : null}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: contentEntranceEase }}
        >
          {staleArgs ? (
            <motion.div className={bannerCss} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {renderStaleError ? (
                renderStaleError(staleArgs)
              ) : (
                <DefaultStaleError {...staleArgs} />
              )}
            </motion.div>
          ) : null}
          <div
            className={cx(
              animatedContentCss,
              refreshing ? animatedContentRefreshingCss : undefined,
            )}
          >
            {children}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
