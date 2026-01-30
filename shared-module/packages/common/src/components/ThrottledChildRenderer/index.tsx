"use client"

import { css } from "@emotion/css"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  type QueueConfig,
  useConcurrencyThrottle,
  useParticipantView,
} from "../../hooks/useConcurrencyThrottle"
import { useEverTrue } from "../../hooks/useEverTrue"
import { useHasRandomTimeoutPassed } from "../../hooks/useHasRandomTimeoutPassed"
import { useInView } from "../../hooks/useInView"

export type ChildFactoryWithCallback = (onReady: () => void) => React.ReactNode

interface ThrottledChildRendererProps {
  qid: string
  id: string
  children: React.ReactNode | ChildFactoryWithCallback
  rootMargin?: string
  placeholder?: React.ReactNode
  minPlaceholderHeight?: number
  queueConfig?: Partial<QueueConfig>
  safetyMinMs?: number
  safetyMaxMs?: number
}

/**
 * Render when any gate flips true:
 *  - ever in viewport
 *  - queue has ever activated us
 *  - a random safety timeout has passed (considered only after joining the queue)
 *
 * When any gate flips, we also LEAVE the queue so others can activate/render too.
 */
export function ThrottledChildRenderer({
  qid,
  id,
  children,
  rootMargin = "200px",
  placeholder,
  minPlaceholderHeight = 200,
  queueConfig,
  safetyMinMs = 3500,
  safetyMaxMs = 6500,
}: ThrottledChildRendererProps) {
  const [ref, inView] = useInView({ rootMargin })
  const inViewEver = useEverTrue(inView)

  const stableQueueConfig = useMemo(
    () => queueConfig,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queueConfig?.capacity, queueConfig?.maxHoldMs],
  )
  const { join, leave } = useConcurrencyThrottle(qid, stableQueueConfig)
  const participantIdRef = useRef<string | undefined>(undefined)
  const [participantId, setParticipantId] = useState<string | undefined>(undefined)
  const view = useParticipantView(qid, participantId)
  const activeEver = useEverTrue(view.isActive)
  const joinTimeRef = useRef<number | null>(null)
  const joiningRef = useRef<boolean>(false)
  const hasLeftRef = useRef<boolean>(false)
  const mountedOnceRef = useRef<boolean>(false)

  // Start a random safety timeout (monotonic),
  // but only *consider* it once we've actually joined the queue.
  const timeoutPassed = useHasRandomTimeoutPassed(safetyMinMs, safetyMaxMs)
  const timeoutConsidered = useMemo(
    () => (participantId ? timeoutPassed : false),
    [participantId, timeoutPassed],
  )

  // Single render gate: once any of these has *ever* been true, we render.
  const readyToRender = useEverTrue(inViewEver, activeEver, timeoutConsidered)
  const readyToRenderRef = useRef<boolean>(false)

  useEffect(() => {
    if (readyToRender && !readyToRenderRef.current) {
      readyToRenderRef.current = true
    }
  }, [readyToRender])

  // Join the queue while off-screen and not yet ready.
  // Use mountedOnceRef to suppress StrictMode double-mount noise in dev.
  useEffect(() => {
    if (mountedOnceRef.current) {
      return
    }
    mountedOnceRef.current = true

    if (!inViewEver && !participantIdRef.current && !readyToRender && !joiningRef.current) {
      joiningRef.current = true
      joinTimeRef.current = Date.now()
      const pid = id
      participantIdRef.current = pid
      setParticipantId(pid)
      join(pid)
      return () => {
        leave(pid)
      }
    }
    // We intentionally use minimal deps to prevent re-render loops:
    // - inViewEver/readyToRender: omitted to prevent cleanup->join cycles when they change
    // - join/leave: omitted because they're recreated on every Jotai update, causing loops
    // The effect should only run once per component instance (based on stable id/qid).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, qid])

  // As soon as ANY gate has ever flipped true, we no longer participate in the queue.
  useEffect(() => {
    if (!hasLeftRef.current && readyToRender && participantId) {
      hasLeftRef.current = true
      leave(participantId)
      setParticipantId(undefined)
      participantIdRef.current = undefined
      joiningRef.current = false
    }
  }, [readyToRender, participantId, leave])

  const onReadyRef = useRef<(() => void) | null>(null)

  const handleReady = useCallback(() => {
    // Child signaled ready - this is just a callback, not for leaving the queue.
    // We leave the queue when readyToRender becomes true (any gate opens).
  }, [])

  onReadyRef.current = handleReady

  const content = useMemo(() => {
    if (typeof children === "function") {
      return (children as ChildFactoryWithCallback)(() => onReadyRef.current?.())
    }
    return children
  }, [children])

  return (
    <div ref={ref} data-testid={`throttled-renderer-${id}`}>
      {readyToRender
        ? content
        : (placeholder ?? (
            <div
              className={css`
                min-height: ${minPlaceholderHeight}px;
              `}
            />
          ))}
    </div>
  )
}

export default ThrottledChildRenderer
