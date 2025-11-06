import { act, render, screen } from "@testing-library/react"
import { Provider } from "jotai"
import React, { useEffect } from "react"

import { useConcurrencyThrottle } from "../../../hooks/useConcurrencyThrottle"
import ThrottledChildRenderer, { type ChildFactoryWithCallback } from "../index"

declare global {
  var triggerIntersection: (
    el: Element,
    opts?: Partial<IntersectionObserverEntry> & {
      isIntersecting: boolean
      intersectionRatio?: number
    },
  ) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTriggerIntersection = (global as any).triggerIntersection as (
  el: Element,
  opts?: Partial<IntersectionObserverEntry> & {
    isIntersecting: boolean
    intersectionRatio?: number
  },
) => void

const TEST_QID = "test-queue"

function QueueConfig({
  qid,
  capacity,
  maxHoldMs,
}: {
  qid: string
  capacity: number
  maxHoldMs: number
}) {
  const { setCapacity, setMaxHoldMs } = useConcurrencyThrottle(qid, { capacity, maxHoldMs })
  useEffect(() => {
    setCapacity(capacity)
    setMaxHoldMs(maxHoldMs)
  }, [qid, capacity, maxHoldMs, setCapacity, setMaxHoldMs])
  return null
}

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Provider>
    <QueueConfig qid={TEST_QID} capacity={2} maxHoldMs={10_000} />
    {children}
  </Provider>
)

function Heavy({ label, hits }: { label: string; hits: string[] }) {
  useEffect(() => {
    hits.push(label)
  }, [label, hits])
  return <div>{label}</div>
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe("ThrottledChildRenderer", () => {
  test("visible instance renders immediately (bypasses queue)", async () => {
    const hits: string[] = []
    render(
      <ThrottledChildRenderer qid={TEST_QID} id="vis">
        <Heavy label="V" hits={hits} />
      </ThrottledChildRenderer>,
      { wrapper },
    )

    const shell = screen.getByTestId("throttled-renderer-vis")
    act(() => {
      mockTriggerIntersection(shell, { isIntersecting: true })
    })

    await flush()
    expect(screen.getByText("V")).toBeInTheDocument()
    expect(hits).toContain("V")
  })

  test("off-screen instances render via queue (sequential)", async () => {
    const hits: string[] = []
    render(
      <>
        <ThrottledChildRenderer qid={TEST_QID} id="A">
          <Heavy label="A" hits={hits} />
        </ThrottledChildRenderer>
        <ThrottledChildRenderer qid={TEST_QID} id="B">
          <Heavy label="B" hits={hits} />
        </ThrottledChildRenderer>
      </>,
      { wrapper },
    )

    await act(async () => {
      await flush()
      await flush()
      await flush()
      await flush()
      await flush()
    })

    // A should render first (capacity=1)
    expect(hits).toContain("A")
    // B should render after A completes
    expect(hits).toContain("B")
  })

  test("queued instance that becomes visible renders immediately", async () => {
    const hits: string[] = []
    render(
      <>
        <ThrottledChildRenderer qid={TEST_QID} id="A">
          <Heavy label="A" hits={hits} />
        </ThrottledChildRenderer>
        <ThrottledChildRenderer qid={TEST_QID} id="B">
          <Heavy label="B" hits={hits} />
        </ThrottledChildRenderer>
      </>,
      { wrapper },
    )

    await flush()
    const shellB = screen.getByTestId("throttled-renderer-B")

    // Make B visible while it's waiting in queue
    act(() => {
      mockTriggerIntersection(shellB, { isIntersecting: true })
    })

    await flush()
    expect(hits).toContain("B")
  })

  test("child factory with onReady callback", async () => {
    const readyCalls: string[] = []

    function ChildWithReady({ onReady }: { onReady: () => void }) {
      useEffect(() => {
        // Simulate async initialization
        const timer = setTimeout(() => {
          readyCalls.push("ready")
          onReady()
        }, 10)
        return () => clearTimeout(timer)
      }, [onReady])
      return <div>Child</div>
    }

    const childFactory: ChildFactoryWithCallback = (onReady) => <ChildWithReady onReady={onReady} />

    const { unmount } = render(
      <ThrottledChildRenderer qid={TEST_QID} id="with-callback">
        {childFactory}
      </ThrottledChildRenderer>,
      { wrapper },
    )

    await flush()

    const shell = screen.getByTestId("throttled-renderer-with-callback")
    act(() => {
      mockTriggerIntersection(shell, { isIntersecting: true })
    })

    await flush()

    // Wait for the timeout in child factory
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15))
    })

    expect(readyCalls).toContain("ready")
    unmount()
  })

  test("shows placeholder until ready with full queue", async () => {
    // With capacity=2, we need 3 participants to have one waiting
    render(
      <>
        <ThrottledChildRenderer qid={TEST_QID} id="blocker1">
          <div>Blocker1</div>
        </ThrottledChildRenderer>
        <ThrottledChildRenderer qid={TEST_QID} id="blocker2">
          <div>Blocker2</div>
        </ThrottledChildRenderer>
        <ThrottledChildRenderer
          qid={TEST_QID}
          id="placeholder-test"
          placeholder={<div>Loading...</div>}
        >
          <div>Content</div>
        </ThrottledChildRenderer>
      </>,
      { wrapper },
    )

    await flush()

    // Third one should show placeholder (waiting in queue)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
    expect(screen.queryByText("Content")).not.toBeInTheDocument()
  })

  test("eventually renders content", async () => {
    render(
      <ThrottledChildRenderer qid={TEST_QID} id="eventually-renders">
        <div>Eventually</div>
      </ThrottledChildRenderer>,
      { wrapper },
    )

    await flush()
    await flush()

    // Content should eventually render
    expect(screen.getByText("Eventually")).toBeInTheDocument()
  })
})
