"use client"

import { act, render } from "@testing-library/react"
import type React from "react"

import type MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type { IframeConnectionState } from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type { ExerciseIframeState } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import ExerciseTaskIframe from "../ExerciseTaskIframe"

type IframeProps = React.ComponentProps<typeof MessageChannelIFrame>

let latestIframeProps: IframeProps | null = null

jest.mock("@/shared-module/exercise-iframe-host/MessageChannelIFrame", () => ({
  __esModule: true,
  default: (props: IframeProps) => {
    latestIframeProps = props
    return null
  },
}))

jest.mock("@/shared-module/common/components/ThrottledChildRenderer", () => ({
  ThrottledChildRenderer: ({ children }: { children: (onReady: () => void) => React.ReactNode }) =>
    children(() => {}),
}))

jest.mock("@/shared-module/components", () => ({
  useDialog: () => ({ alert: jest.fn(), confirm: jest.fn() }),
  ErrorNotice: () => null,
}))

jest.mock("@/state/course-material", () => {
  const { atom } = jest.requireActual("jotai")
  return {
    courseMaterialAtom: atom({
      course: { id: "course-1" },
      page: { id: "page-1" },
      examData: null,
    }),
  }
})

const SECRET_ANSWER = "secret-answer-text"
const IFRAME_URL = "https://factorial-analysis.mooc.fi/iframe"

const answerState: ExerciseIframeState = {
  view_type: "answer-exercise",
  exercise_task_id: "task-1",
  user_information: { pseudonymous_id: "pseudo", signed_in: true },
  data: {
    public_spec: { question: "q" },
    previous_submission: { answer: SECRET_ANSWER } as never,
  },
}

const fetchMock = jest.fn((_url: string, _init: RequestInit) =>
  Promise.resolve({ ok: true, status: 204 } as Response),
)

const taskElement = (url: string, title = "Exercise") => (
  <ExerciseTaskIframe
    exerciseTaskId="task-1"
    exerciseServiceSlug="factor-analysis"
    url={url}
    postThisStateToIFrame={answerState}
    setAnswer={jest.fn()}
    title={title}
  />
)

const renderTask = () => {
  const result = render(taskElement(IFRAME_URL))
  return {
    ...result,
    rerenderWith: (url: string, title?: string) => result.rerender(taskElement(url, title)),
  }
}

const iframeProps = (): IframeProps => {
  if (!latestIframeProps) {
    throw new Error("MessageChannelIFrame was not rendered")
  }
  return latestIframeProps
}

const reportState = (state: Partial<IframeConnectionState>) => {
  act(() => {
    iframeProps().onConnectionStateChange?.({
      status: "loading",
      stage: "mounted",
      elapsedMs: 0,
      reloadCount: 0,
      ...state,
    })
  })
}

const sentReports = () =>
  fetchMock.mock.calls.map(([url, init]) => {
    expect(url).toBe("/api/v0/errors")
    return JSON.parse(init.body as string)
  })

beforeEach(() => {
  latestIframeProps = null
  fetchMock.mockClear()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe("ExerciseBlock iframe failure reporting", () => {
  it("sends exactly one event with the load context and no answer data", () => {
    renderTask()
    act(() => {
      iframeProps().onMessageFromIframe(
        { message: "current-state", data: { answer: SECRET_ANSWER }, valid: true },
        {} as MessagePort,
      )
    })

    reportState({ status: "loading" })
    reportState({ status: "failed", stage: "document-loaded", elapsedMs: 10000, reloadCount: 1 })

    const reports = sentReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      error_source: "frontend",
      message: "Exercise iframe failed to load (factor-analysis)",
      details: {
        kind: "exercise-iframe-failure",
        failure: "load-failed",
        exercise_service_slug: "factor-analysis",
        iframe_origin: "https://factorial-analysis.mooc.fi",
        view_type: "answer-exercise",
        stage: "document-loaded",
        elapsed_ms: 10000,
        reload_count: 1,
        user_agent: navigator.userAgent,
        course_id: "course-1",
        page_id: "page-1",
        exam_id: null,
        exercise_task_id: "task-1",
      },
    })
    const body = fetchMock.mock.calls[0]![1].body as string // safe: one call asserted above
    expect(body).not.toContain(SECRET_ANSWER)
    expect(body).not.toContain("public_spec")
  })

  it("sends nothing for an iframe that connects", () => {
    renderTask()
    reportState({ status: "loading" })
    reportState({ status: "connected", stage: "ready-received", elapsedMs: 800 })
    reportState({ status: "loading", reloadCount: 1 })
    reportState({ status: "connected", stage: "ready-received", reloadCount: 1 })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not duplicate the event across reloads and re-renders", () => {
    const { rerenderWith } = renderTask()
    reportState({ status: "failed", stage: "mounted", elapsedMs: 10000 })
    reportState({ status: "loading", reloadCount: 1 })
    reportState({ status: "failed", stage: "document-loaded", elapsedMs: 10000, reloadCount: 1 })
    rerenderWith(IFRAME_URL, "Exercise renamed")
    reportState({ status: "failed", stage: "document-loaded", elapsedMs: 10000, reloadCount: 2 })

    expect(sentReports()).toHaveLength(1)
  })

  it("reports again once the task points to another url", () => {
    const { rerenderWith } = renderTask()
    reportState({ status: "failed", elapsedMs: 10000 })
    rerenderWith("https://other.example/iframe")
    reportState({ status: "failed", elapsedMs: 10000 })

    expect(sentReports().map((report) => report.details.iframe_origin)).toEqual([
      "https://factorial-analysis.mooc.fi",
      "https://other.example",
    ])
  })

  it("reports a plugin's reload request once, with the last connection state", () => {
    renderTask()
    reportState({ status: "connected", stage: "state-sent", elapsedMs: 900 })
    act(() => {
      iframeProps().onReloadRequested?.()
      iframeProps().onReloadRequested?.()
    })

    const reports = sentReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      message: "Exercise iframe requested a reload (factor-analysis)",
      details: { failure: "reload-requested", stage: "state-sent", elapsed_ms: 900 },
    })
  })
})
