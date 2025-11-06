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

  const { join, leave } = useConcurrencyThrottle(qid, queueConfig)
  const [participantId, setParticipantId] = useState<string | undefined>(undefined)
  const view = useParticipantView(qid, participantId)
  const activeEver = useEverTrue(view.isActive)

  // Start a random safety timeout (monotonic),
  // but only *consider* it once we've actually joined the queue.
  const timeoutPassed = useHasRandomTimeoutPassed(safetyMinMs, safetyMaxMs)
  const timeoutConsidered = useMemo(
    () => (participantId ? timeoutPassed : false),
    [participantId, timeoutPassed],
  )

  // Single render gate: once any of these has *ever* been true, we render.
  const readyToRender = useEverTrue(inViewEver, activeEver, timeoutConsidered)

  // Join the queue while off-screen and not yet ready.
  useEffect(() => {
    if (!inViewEver && !participantId && !readyToRender) {
      const pid = join(id)
      setParticipantId(pid)
      return () => {
        leave(pid)
      }
    }
  }, [inViewEver, participantId, readyToRender, join, leave, id])

  // As soon as ANY gate has ever flipped true, we no longer participate in the queue.
  useEffect(() => {
    if (readyToRender && participantId) {
      leave(participantId)
      setParticipantId(undefined)
    }
  }, [readyToRender, participantId, leave])

  const onReadyRef = useRef<(() => void) | null>(null)

  const handleReady = useCallback(() => {
    if (participantId) {
      leave(participantId)
      setParticipantId(undefined)
    }
  }, [participantId, leave])

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
