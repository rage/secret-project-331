"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

import { reportErrorOccurrence } from "../errors/reportErrorOccurrence"

/** Where an exercise iframe is embedded; ids are sent with the report when known. */
export interface ExerciseIframeReportContext {
  url: string
  exerciseServiceSlug: string | null | undefined
  /** The `view_type` posted to the iframe. */
  viewType: string | null | undefined
  courseId?: string | null | undefined
  examId?: string | null | undefined
  pageId?: string | null | undefined
  exerciseTaskId?: string | null | undefined
}

// Mirrors exercise-iframe-host's `IframeConnectionState`, which common can't import: it is also
// vendored into services that don't vendor the host SDK.
interface ConnectionState {
  status: "loading" | "connected" | "failed"
  stage: string
  elapsedMs: number
  reloadCount: number
}

const FAILURE_MESSAGES = {
  "load-failed": "Exercise iframe failed to load",
  "reload-requested": "Exercise iframe requested a reload",
} as const

type FailureKind = keyof typeof FAILURE_MESSAGES

const EXERCISE_IFRAME_FAILURE_REPORT_KIND = "exercise-iframe-failure"

/**
 * Reports an exercise iframe that failed to load (`status: "failed"`) or asked for a reload
 * (plugins do so after a crash) to the backend's error occurrences. Pass the returned handlers to
 * `MessageChannelIFrame`'s props of the same names.
 *
 * Each failure kind is reported at most once per hook instance and `url`, so automatic reloads and
 * re-renders don't duplicate it. No answer content is sent.
 */
export function useReportExerciseIframeFailure(context: ExerciseIframeReportContext): {
  onConnectionStateChange: (state: ConnectionState) => void
  onReloadRequested: () => void
} {
  const contextRef = useRef(context)
  useEffect(() => {
    contextRef.current = context
  })
  const lastStateRef = useRef<ConnectionState | null>(null)
  const reportedRef = useRef<{ url: string; kinds: Set<FailureKind> }>({
    url: context.url,
    kinds: new Set(),
  })

  const report = useCallback((kind: FailureKind) => {
    const current = contextRef.current
    if (reportedRef.current.url !== current.url) {
      reportedRef.current = { url: current.url, kinds: new Set() }
    }
    if (reportedRef.current.kinds.has(kind)) {
      return
    }
    reportedRef.current.kinds.add(kind)

    const state = lastStateRef.current
    void reportErrorOccurrence({
      error_source: "frontend",
      message: `${FAILURE_MESSAGES[kind]} (${current.exerciseServiceSlug ?? "unknown service"})`,
      details: {
        kind: EXERCISE_IFRAME_FAILURE_REPORT_KIND,
        failure: kind,
        exercise_service_slug: current.exerciseServiceSlug ?? null,
        iframe_origin: originOf(current.url),
        view_type: current.viewType ?? null,
        stage: state?.stage ?? null,
        elapsed_ms: state?.elapsedMs ?? null,
        reload_count: state?.reloadCount ?? null,
        user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
        course_id: current.courseId ?? null,
        exam_id: current.examId ?? null,
        page_id: current.pageId ?? null,
        exercise_task_id: current.exerciseTaskId ?? null,
      },
    })
  }, [])

  const onConnectionStateChange = useCallback(
    (state: ConnectionState) => {
      lastStateRef.current = state
      if (state.status === "failed") {
        report("load-failed")
      }
    },
    [report],
  )

  const onReloadRequested = useCallback(() => report("reload-requested"), [report])

  return useMemo(
    () => ({ onConnectionStateChange, onReloadRequested }),
    [onConnectionStateChange, onReloadRequested],
  )
}

function originOf(url: string): string | null {
  try {
    return new URL(url, window.location.href).origin
  } catch {
    return null
  }
}
