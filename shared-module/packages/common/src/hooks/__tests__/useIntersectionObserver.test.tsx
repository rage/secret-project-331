import { act, render, screen } from "@testing-library/react"

import { useIntersectionObserver } from "../useIntersectionObserver"

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

function Demo({ rootMargin = "0px" }: { rootMargin?: string }) {
  const { ref, inView, refresh } = useIntersectionObserver({ rootMargin })
  return (
    <>
      <button data-testid="refresh" onClick={refresh} />
      <div data-testid="target" ref={ref} />
      <div data-testid="state">{String(inView)}</div>
    </>
  )
}

test("creates an observer and toggles state", () => {
  render(<Demo />)
  const el = screen.getByTestId("target")
  act(() => {
    triggerIntersection(el, { isIntersecting: true })
  })

  expect(screen.getByTestId("state").textContent).toBe("true")
  act(() => {
    triggerIntersection(el, { isIntersecting: false })
  })

  expect(screen.getByTestId("state").textContent).toBe("false")
})

test("refresh can be called safely", () => {
  render(<Demo />)
  const el = screen.getByTestId("target")
  act(() => {
    screen.getByTestId("refresh").click()
  })
  act(() => {
    triggerIntersection(el, { isIntersecting: true })
  })

  expect(screen.getByTestId("state").textContent).toBe("true")
})

test("changing options re-observes", () => {
  const { rerender } = render(<Demo rootMargin="0px" />)
  const el = screen.getByTestId("target")
  act(() => {
    triggerIntersection(el, { isIntersecting: true })
  })

  expect(screen.getByTestId("state").textContent).toBe("true")

  rerender(<Demo rootMargin="100px" />)
  act(() => {
    triggerIntersection(el, { isIntersecting: false })
  })

  expect(screen.getByTestId("state").textContent).toBe("false")
})
