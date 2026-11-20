"use client"

import { renderHook } from "@testing-library/react"

import { reportErrorOccurrence } from "../../errors/reportErrorOccurrence"
import {
  type ExerciseIframeReportContext,
  useReportExerciseIframeFailure,
} from "../useReportExerciseIframeFailure"

jest.mock("../../errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: jest.fn(() => Promise.resolve()),
}))

const reportMock = jest.mocked(reportErrorOccurrence)

const FULL_CONTEXT: ExerciseIframeReportContext = {
  url: "https://plugins.example.com/quizzes/iframe?x=1",
  exerciseServiceSlug: "quizzes",
  viewType: "answer-exercise",
  courseId: "course-1",
  examId: "exam-1",
  pageId: "page-1",
  exerciseTaskId: "task-1",
}

const FAILED_STATE = {
  status: "failed" as const,
  stage: "handshake",
  elapsedMs: 15000,
  reloadCount: 2,
}

const DETAIL_KEYS = [
  "course_id",
  "elapsed_ms",
  "exam_id",
  "exercise_service_slug",
  "exercise_task_id",
  "failure",
  "iframe_origin",
  "kind",
  "page_id",
  "reload_count",
  "stage",
  "user_agent",
  "view_type",
]

function setUp(initialContext: ExerciseIframeReportContext = FULL_CONTEXT) {
  return renderHook(({ context }) => useReportExerciseIframeFailure(context), {
    initialProps: { context: initialContext },
  })
}

function reportAt(callIndex: number) {
  const call = reportMock.mock.calls[callIndex]
  if (call === undefined) {
    throw new Error(`No report at index ${callIndex}`)
  }
  return call[0]
}

function reportedDetails(callIndex = 0): Record<string, unknown> {
  return reportAt(callIndex).details as Record<string, unknown>
}

beforeEach(() => reportMock.mockClear())

describe("useReportExerciseIframeFailure", () => {
  test("reports a failed load once with the full details", () => {
    const { result } = setUp()
    result.current.onConnectionStateChange(FAILED_STATE)

    expect(reportMock).toHaveBeenCalledTimes(1)
    expect(reportMock).toHaveBeenCalledWith({
      error_source: "frontend",
      message: "Exercise iframe failed to load (quizzes)",
      details: {
        kind: "exercise-iframe-failure",
        failure: "load-failed",
        exercise_service_slug: "quizzes",
        iframe_origin: "https://plugins.example.com",
        view_type: "answer-exercise",
        stage: "handshake",
        elapsed_ms: 15000,
        reload_count: 2,
        user_agent: navigator.userAgent,
        course_id: "course-1",
        exam_id: "exam-1",
        page_id: "page-1",
        exercise_task_id: "task-1",
      },
    })
  })

  test("details contain only the expected keys, so no answer content can leak", () => {
    const { result } = setUp()
    result.current.onConnectionStateChange(FAILED_STATE)
    result.current.onReloadRequested()

    expect(Object.keys(reportedDetails(0)).toSorted()).toEqual(DETAIL_KEYS)
    expect(Object.keys(reportedDetails(1)).toSorted()).toEqual(DETAIL_KEYS)
    expect(Object.keys(reportAt(0)).toSorted()).toEqual(["details", "error_source", "message"])
  })

  test("loading and connected states report nothing", () => {
    const { result } = setUp()
    result.current.onConnectionStateChange({ ...FAILED_STATE, status: "loading" })
    result.current.onConnectionStateChange({ ...FAILED_STATE, status: "connected" })

    expect(reportMock).not.toHaveBeenCalled()
  })

  test("repeated failures and re-renders don't duplicate the report", () => {
    const { result, rerender } = setUp()
    result.current.onConnectionStateChange(FAILED_STATE)
    rerender({ context: { ...FULL_CONTEXT } })
    result.current.onConnectionStateChange({ ...FAILED_STATE, reloadCount: 3 })
    result.current.onConnectionStateChange(FAILED_STATE)

    expect(reportMock).toHaveBeenCalledTimes(1)
  })

  test("each failure kind is reported once, independently", () => {
    const { result } = setUp()
    result.current.onReloadRequested()
    result.current.onReloadRequested()
    result.current.onConnectionStateChange(FAILED_STATE)
    result.current.onConnectionStateChange(FAILED_STATE)
    result.current.onReloadRequested()

    expect(reportMock).toHaveBeenCalledTimes(2)
    expect(reportedDetails(0).failure).toBe("reload-requested")
    expect(reportAt(0).message).toBe("Exercise iframe requested a reload (quizzes)")
    expect(reportedDetails(1).failure).toBe("load-failed")
  })

  test("a URL change re-arms reporting for both kinds", () => {
    const { result, rerender } = setUp()
    result.current.onConnectionStateChange(FAILED_STATE)
    result.current.onReloadRequested()

    rerender({ context: { ...FULL_CONTEXT, url: "https://other.example.com/iframe" } })
    result.current.onConnectionStateChange(FAILED_STATE)
    result.current.onReloadRequested()
    result.current.onConnectionStateChange(FAILED_STATE)
    result.current.onReloadRequested()

    expect(reportMock).toHaveBeenCalledTimes(4)
    expect(reportedDetails(2)).toMatchObject({
      failure: "load-failed",
      iframe_origin: "https://other.example.com",
    })
    expect(reportedDetails(3)).toMatchObject({
      failure: "reload-requested",
      iframe_origin: "https://other.example.com",
    })
  })

  test("reports the context of the latest render", () => {
    const { result, rerender } = setUp()
    rerender({
      context: {
        ...FULL_CONTEXT,
        viewType: "view-submission",
        courseId: "course-2",
        examId: null,
        pageId: "page-2",
        exerciseTaskId: "task-2",
      },
    })
    result.current.onConnectionStateChange(FAILED_STATE)

    expect(reportedDetails()).toMatchObject({
      view_type: "view-submission",
      course_id: "course-2",
      exam_id: null,
      page_id: "page-2",
      exercise_task_id: "task-2",
    })
  })

  test("an unparsable URL gives a null origin", () => {
    const { result } = setUp({ ...FULL_CONTEXT, url: "http://[::1" })
    result.current.onConnectionStateChange(FAILED_STATE)

    expect(reportedDetails().iframe_origin).toBeNull()
  })

  test("a reload request before any connection state has null state fields", () => {
    const { result } = setUp()
    result.current.onReloadRequested()

    expect(reportedDetails()).toMatchObject({
      stage: null,
      elapsed_ms: null,
      reload_count: null,
    })
  })

  test("missing optional ids are null and a missing slug is named unknown service", () => {
    const { result } = setUp({
      url: FULL_CONTEXT.url,
      exerciseServiceSlug: undefined,
      viewType: undefined,
    })
    result.current.onConnectionStateChange(FAILED_STATE)

    expect(reportAt(0).message).toBe("Exercise iframe failed to load (unknown service)")
    expect(reportedDetails()).toMatchObject({
      exercise_service_slug: null,
      view_type: null,
      course_id: null,
      exam_id: null,
      page_id: null,
      exercise_task_id: null,
    })
  })

  test("returned handlers are stable across re-renders with a changing context", () => {
    const { result, rerender } = setUp()
    const first = result.current
    rerender({ context: { ...FULL_CONTEXT, viewType: "view-submission", pageId: "page-2" } })
    rerender({ context: { ...FULL_CONTEXT, url: "https://other.example.com/iframe" } })

    expect(result.current).toBe(first)
    expect(result.current.onConnectionStateChange).toBe(first.onConnectionStateChange)
    expect(result.current.onReloadRequested).toBe(first.onReloadRequested)
  })
})
