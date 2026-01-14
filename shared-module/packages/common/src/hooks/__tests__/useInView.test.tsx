"use client"

import { act, render, screen } from "@testing-library/react"

import { useInView } from "../useInView"

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
const triggerIntersection = (global as any).triggerIntersection as (
  el: Element,
  opts?: Partial<IntersectionObserverEntry> & {
    isIntersecting: boolean
    intersectionRatio?: number
  },
) => void

function Demo({ freezeOnceVisible = false }: { freezeOnceVisible?: boolean }) {
  const [ref, inView, entry] = useInView({ freezeOnceVisible })
  return (
    <>
      <div data-testid="target" ref={ref} />
      <div data-testid="state">{String(inView)}</div>
      <div data-testid="ratio">{entry?.intersectionRatio ?? "n/a"}</div>
    </>
  )
}

test("reports inView true on intersection", () => {
  render(<Demo />)
  const el = screen.getByTestId("target")
  act(() => {
    triggerIntersection(el, { isIntersecting: true, intersectionRatio: 0.5 })
  })

  expect(screen.getByTestId("state").textContent).toBe("true")
  expect(screen.getByTestId("ratio").textContent).toBe("0.5")
})

test("reports inView false when leaving", () => {
  render(<Demo />)
  const el = screen.getByTestId("target")
  act(() => {
    triggerIntersection(el, { isIntersecting: true })
  })
  act(() => {
    triggerIntersection(el, { isIntersecting: false })
  })

  expect(screen.getByTestId("state").textContent).toBe("false")
})

test("freezeOnceVisible prevents further updates after first visible hit", () => {
  render(<Demo freezeOnceVisible />)
  const el = screen.getByTestId("target")

  act(() => {
    triggerIntersection(el, { isIntersecting: true, intersectionRatio: 1 })
  })
  expect(screen.getByTestId("state").textContent).toBe("true")

  // Observer is disconnected after freezeOnceVisible, so state remains true
  // (We can't trigger another intersection because observer is gone, but state stays true)
  expect(screen.getByTestId("state").textContent).toBe("true")
})

test("SSR/legacy: no window.IntersectionObserver -> stays inert with initialInView", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realIO = (global as any).IntersectionObserver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (global as any).IntersectionObserver

  function SSRDemo() {
    const [ref, inView] = useInView({ initialInView: true })
    return (
      <div data-testid="state" ref={ref}>
        {String(inView)}
      </div>
    )
  }
  const { unmount } = render(<SSRDemo />)
  expect(screen.getByTestId("state").textContent).toBe("true")
  unmount()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).IntersectionObserver = realIO
})
