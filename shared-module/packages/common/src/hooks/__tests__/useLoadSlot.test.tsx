"use client"

import { act, render, screen } from "@testing-library/react"
import React from "react"

import {
  type ChildFactoryWithCallback,
  ThrottledChildRenderer,
} from "../../components/ThrottledChildRenderer"
import { createLoadSlotScheduler, type LoadSlotScheduler } from "../useLoadSlot"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const CAPACITY = 3
const MAX_HOLD_MS = 8000
/** Longer than the idle fallback delay, so a pending background fill has run. */
const IDLE_MS = 500

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  document.body.innerHTML = ""
})

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

function statuses(scheduler: LoadSlotScheduler, ids: string[]) {
  return ids.map((id) => scheduler.getStatus(id))
}

function holdingIds(scheduler: LoadSlotScheduler, ids: string[]) {
  return ids.filter((id) => scheduler.getStatus(id) === "holding")
}

/** Registers participants backed by elements appended to the body in id order. */
function setUp(count: number) {
  const scheduler = createLoadSlotScheduler({ capacity: CAPACITY, maxHoldMs: MAX_HOLD_MS })
  const ids = Array.from({ length: count }, (_, i) => `p${i}`)
  for (const id of ids) {
    const element = document.createElement("div")
    document.body.append(element)
    scheduler.register(id, element)
  }
  return { scheduler, ids }
}

describe("load slot scheduler", () => {
  test("background fill grants slots in document order up to capacity", () => {
    const { scheduler, ids } = setUp(6)
    expect(holdingIds(scheduler, ids)).toEqual([])
    advance(IDLE_MS)
    expect(holdingIds(scheduler, ids)).toEqual(["p0", "p1", "p2"])
  })

  test("document order follows the DOM, not registration order", () => {
    const scheduler = createLoadSlotScheduler({ capacity: 1, maxHoldMs: MAX_HOLD_MS })
    const first = document.createElement("div")
    const second = document.createElement("div")
    document.body.append(first, second)
    scheduler.register("second", second)
    scheduler.register("first", first)
    advance(IDLE_MS)
    expect(scheduler.getStatus("first")).toBe("holding")
    expect(scheduler.getStatus("second")).toBe("waiting")
  })

  test("never more than capacity load while participants keep releasing", () => {
    const { scheduler, ids } = setUp(10)
    let maxHolding = 0
    scheduler.subscribe(() => {
      maxHolding = Math.max(maxHolding, holdingIds(scheduler, ids).length)
    })
    for (let round = 0; round < 8; round++) {
      advance(IDLE_MS)
      const [first] = holdingIds(scheduler, ids)
      if (first) {
        scheduler.release(first)
      }
    }
    expect(maxHolding).toBe(CAPACITY)
    expect(statuses(scheduler, ids).filter((status) => status === "released")).toHaveLength(8)
  })

  test("a slot is not released on activation", () => {
    const { scheduler, ids } = setUp(4)
    advance(IDLE_MS)
    advance(MAX_HOLD_MS - 1000)
    expect(statuses(scheduler, ids)).toEqual(["holding", "holding", "holding", "waiting"])
  })

  test("release on connected or on failure frees the slot for the next participant", () => {
    const { scheduler, ids } = setUp(5)
    advance(IDLE_MS)
    scheduler.release("p0")
    scheduler.release("p1")
    advance(IDLE_MS)
    expect(statuses(scheduler, ids)).toEqual([
      "released",
      "released",
      "holding",
      "holding",
      "holding",
    ])
  })

  test("the hold timeout releases a slot that never reports", () => {
    const { scheduler } = setUp(2)
    scheduler.setNearViewport("p0", true)
    advance(MAX_HOLD_MS - 1)
    expect(scheduler.getStatus("p0")).toBe("holding")
    expect(scheduler.getStatus("p1")).toBe("waiting")
    advance(1)
    expect(scheduler.getStatus("p0")).toBe("released")
    advance(IDLE_MS)
    expect(scheduler.getStatus("p1")).toBe("holding")
  })

  test("release is a no-op for a waiting participant", () => {
    const { scheduler } = setUp(1)
    scheduler.release("p0")
    expect(scheduler.getStatus("p0")).toBe("waiting")
  })

  test("a near-viewport participant jumps the queue and may exceed capacity by one", () => {
    const { scheduler, ids } = setUp(8)
    advance(IDLE_MS)
    expect(holdingIds(scheduler, ids)).toEqual(["p0", "p1", "p2"])
    scheduler.setNearViewport("p6", true)
    expect(scheduler.getStatus("p6")).toBe("holding")
    scheduler.setNearViewport("p7", true)
    expect(scheduler.getStatus("p7")).toBe("waiting")
    expect(holdingIds(scheduler, ids)).toHaveLength(CAPACITY + 1)
  })

  test("near-viewport participants are granted at once, without waiting for idle time", () => {
    const { scheduler } = setUp(3)
    scheduler.setNearViewport("p2", true)
    expect(scheduler.getStatus("p2")).toBe("holding")
    expect(scheduler.getStatus("p0")).toBe("waiting")
  })

  test("scrolling re-prioritises waiting participants", () => {
    const { scheduler, ids } = setUp(10)
    for (const id of ["p0", "p1", "p2", "p3", "p4"]) {
      scheduler.setNearViewport(id, true)
    }
    expect(scheduler.getStatus("p4")).toBe("waiting")

    scheduler.setNearViewport("p4", false)
    scheduler.setNearViewport("p8", true)
    scheduler.release("p0")
    expect(scheduler.getStatus("p8")).toBe("holding")
    expect(scheduler.getStatus("p4")).toBe("waiting")
    expect(holdingIds(scheduler, ids)).toEqual(["p1", "p2", "p3", "p8"])
  })

  test("background fill runs only when nothing near the viewport is loading", () => {
    const { scheduler } = setUp(6)
    scheduler.setNearViewport("p3", true)
    advance(IDLE_MS)
    expect(scheduler.getStatus("p0")).toBe("waiting")

    scheduler.release("p3")
    expect(scheduler.getStatus("p0")).toBe("waiting")
    advance(IDLE_MS)
    expect(scheduler.getStatus("p0")).toBe("holding")
  })

  test("background fill uses requestIdleCallback when available", () => {
    const callbacks: (() => void)[] = []
    Object.assign(window, {
      requestIdleCallback: (callback: () => void) => callbacks.push(callback),
    })
    try {
      const { scheduler } = setUp(1)
      advance(IDLE_MS)
      expect(scheduler.getStatus("p0")).toBe("waiting")
      callbacks.forEach((callback) => callback())
      expect(scheduler.getStatus("p0")).toBe("holding")
    } finally {
      Reflect.deleteProperty(window, "requestIdleCallback")
    }
  })

  test("unregistering a participant frees its slot", () => {
    const { scheduler, ids } = setUp(4)
    advance(IDLE_MS)
    scheduler.unregister("p1")
    advance(IDLE_MS)
    expect(holdingIds(scheduler, ids)).toEqual(["p0", "p2", "p3"])
  })
})

describe("ThrottledChildRenderer", () => {
  let queueCounter = 0
  let qid = ""
  beforeEach(() => {
    qid = `test-queue-${queueCounter++}`
  })

  function renderTasks(
    ids: string[],
    childFor: (id: string) => React.ReactNode | ChildFactoryWithCallback,
  ) {
    return (
      <>
        {ids.map((id) => (
          <ThrottledChildRenderer
            key={id}
            qid={qid}
            id={id}
            queueConfig={{ capacity: 1, maxHoldMs: MAX_HOLD_MS }}
          >
            {childFor(id)}
          </ThrottledChildRenderer>
        ))}
      </>
    )
  }

  test("shows a loading placeholder until a slot is granted", () => {
    render(renderTasks(["a", "b"], (id) => <div>child {id}</div>))
    expect(screen.getByTestId("throttled-renderer-a")).toHaveTextContent(
      "throttled-renderer.loading",
    )
    advance(IDLE_MS)
    expect(screen.getByText("child a")).toBeInTheDocument()
    expect(screen.queryByText("child b")).not.toBeInTheDocument()
    expect(screen.getByTestId("throttled-renderer-b")).toHaveTextContent(
      "throttled-renderer.loading",
    )
  })

  test("onReady from the child factory releases its slot", () => {
    let readyA: (() => void) | undefined
    render(
      renderTasks(["a", "b"], (id) => {
        const factory: ChildFactoryWithCallback = (onReady) => {
          if (id === "a") {
            readyA = onReady
          }
          return <div>child {id}</div>
        }
        return factory
      }),
    )
    advance(IDLE_MS)
    expect(screen.queryByText("child b")).not.toBeInTheDocument()
    act(() => readyA?.())
    advance(IDLE_MS)
    expect(screen.getByText("child a")).toBeInTheDocument()
    expect(screen.getByText("child b")).toBeInTheDocument()
  })

  test("a child in view loads before earlier off-screen children", () => {
    render(renderTasks(["a", "b", "c"], (id) => <div>child {id}</div>))
    act(() => {
      globalThis.triggerIntersection(screen.getByTestId("throttled-renderer-c"), {
        isIntersecting: true,
      })
    })
    expect(screen.getByText("child c")).toBeInTheDocument()
    expect(screen.queryByText("child a")).not.toBeInTheDocument()
  })

  test("unmounting a participant frees its slot", () => {
    const { rerender } = render(renderTasks(["a", "b"], (id) => <div>child {id}</div>))
    advance(IDLE_MS)
    expect(screen.getByText("child a")).toBeInTheDocument()
    expect(screen.queryByText("child b")).not.toBeInTheDocument()
    rerender(renderTasks(["b"], (id) => <div>child {id}</div>))
    advance(IDLE_MS)
    expect(screen.getByText("child b")).toBeInTheDocument()
  })

  test("children stay rendered after the slot is released and the status is reported", () => {
    const onStatusChange = jest.fn()
    render(
      <ThrottledChildRenderer
        qid={qid}
        id="a"
        queueConfig={{ capacity: 1, maxHoldMs: MAX_HOLD_MS }}
        onLoadSlotStatusChange={onStatusChange}
      >
        <div>child a</div>
      </ThrottledChildRenderer>,
    )
    advance(IDLE_MS)
    advance(MAX_HOLD_MS)
    expect(screen.getByText("child a")).toBeInTheDocument()
    expect(onStatusChange.mock.calls.map(([status]) => status)).toEqual([
      "waiting",
      "holding",
      "released",
    ])
  })
})
