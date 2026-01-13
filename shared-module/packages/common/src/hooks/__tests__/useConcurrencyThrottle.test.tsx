"use client"

import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import React from "react"

import {
  useConcurrencyThrottle,
  useParticipantView,
  useQueueMetrics,
} from "../useConcurrencyThrottle"

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => <Provider>{children}</Provider>

const TEST_QID = "test-queue"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

function flushTimersBy(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

function renderView(
  qid: string,
  id?: string,
  initial?: Parameters<typeof useConcurrencyThrottle>[1],
) {
  return renderHook(
    (p: { qid: string; id?: string; init?: Parameters<typeof useConcurrencyThrottle>[1] }) => {
      const api = useConcurrencyThrottle(p.qid, p.init)
      const view = useParticipantView(p.qid, p.id)
      const metrics = useQueueMetrics(p.qid)
      return { api, view, metrics }
    },
    { wrapper, initialProps: { qid, id, init: initial } },
  )
}

describe("useConcurrencyThrottle - basics", () => {
  test("join, done, and leave work with capacity=1", () => {
    const { result, rerender } = renderView(TEST_QID, undefined, {
      capacity: 1,
      maxHoldMs: 10_000,
    })

    act(() => result.current.api.join("A"))
    rerender({ qid: TEST_QID, id: "A", init: { capacity: 1, maxHoldMs: 10_000 } })
    expect(result.current.view.status).toBe("active")

    act(() => result.current.api.join("B"))
    rerender({ qid: TEST_QID, id: "B", init: { capacity: 1, maxHoldMs: 10_000 } })
    expect(result.current.view.status).toBe("waiting")

    act(() => result.current.api.done("A"))
    rerender({ qid: TEST_QID, id: "B", init: { capacity: 1, maxHoldMs: 10_000 } })
    expect(result.current.view.status).toBe("active")
  })
})

describe("useConcurrencyThrottle - demotion", () => {
  test("participant is demoted after maxHoldMs", () => {
    const { result, rerender } = renderView(TEST_QID, undefined, {
      capacity: 1,
      maxHoldMs: 1000,
    })

    act(() => {
      result.current.api.join("A")
      result.current.api.join("B")
    })
    rerender({ qid: TEST_QID, id: "A", init: { capacity: 1, maxHoldMs: 1000 } })
    expect(result.current.view.status).toBe("active")

    flushTimersBy(1000)
    rerender({ qid: TEST_QID, id: "A", init: { capacity: 1, maxHoldMs: 1000 } })
    expect(result.current.view.status).toBe("demoted")
    rerender({ qid: TEST_QID, id: "B", init: { capacity: 1, maxHoldMs: 1000 } })
    expect(result.current.view.status).toBe("active")
  })
})
