"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { ColumnResizeHandle, RESIZE_HANDLE_TESTID } from "../ColumnResizeHandle"
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "../columnWidths"

const START_WIDTH = 200

function renderHandle(overrides: Partial<React.ComponentProps<typeof ColumnResizeHandle>> = {}) {
  const handlers = {
    onResizeStart: jest.fn(),
    onResize: jest.fn(),
    onResizeEnd: jest.fn(),
    onReset: jest.fn(),
  }
  const utils = render(
    <ColumnResizeHandle
      columnId="student"
      getWidth={() => START_WIDTH}
      minWidth={MIN_COLUMN_WIDTH}
      maxWidth={MAX_COLUMN_WIDTH}
      label="Resize column Student"
      presentational={false}
      {...handlers}
      {...overrides}
    />,
  )
  return { ...utils, ...handlers, handle: screen.getByTestId(RESIZE_HANDLE_TESTID) }
}

// jsdom has no PointerEvent, so useMove falls back to its mouse branch and listens on window.
function drag(handle: HTMLElement, toClientX: number) {
  fireEvent.mouseDown(handle, { button: 0, clientX: 0 })
  fireEvent.mouseMove(window, { button: 0, clientX: toClientX })
  fireEvent.mouseUp(window, { button: 0 })
}

describe("ColumnResizeHandle", () => {
  it("widens the column by the distance dragged", () => {
    const { handle, onResize } = renderHandle()
    drag(handle, 40)
    expect(onResize).toHaveBeenCalledWith("student", START_WIDTH + 40)
  })

  it("clamps to the minimum width instead of collapsing the column", () => {
    const { handle, onResize } = renderHandle()
    drag(handle, -5000)
    expect(onResize).toHaveBeenLastCalledWith("student", MIN_COLUMN_WIDTH)
  })

  it("resizes with the arrow keys, taking a bigger step when shift is held", () => {
    const { handle, onResize } = renderHandle()
    fireEvent.keyDown(handle, { key: "ArrowRight" })
    const [, steppedWidth] = onResize.mock.calls[0] ?? []
    expect(steppedWidth).toBeGreaterThan(START_WIDTH)

    onResize.mockClear()
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true })
    const [, largeSteppedWidth] = onResize.mock.calls[0] ?? []
    expect(largeSteppedWidth).toBeGreaterThan(steppedWidth as number)
  })

  it("lets a grouped header grow past a single column's ceiling", () => {
    const { handle, onResize } = renderHandle({ maxWidth: MAX_COLUMN_WIDTH * 2 })
    drag(handle, 5000)
    expect(onResize).toHaveBeenLastCalledWith("student", MAX_COLUMN_WIDTH * 2)
  })

  it("resets the column on double click without reporting a resize", () => {
    const { handle, onReset, onResize } = renderHandle()
    fireEvent.doubleClick(handle)
    expect(onReset).toHaveBeenCalledWith("student")
    expect(onResize).not.toHaveBeenCalled()
  })

  it("reports the drag as finished when the handle unmounts mid-gesture", () => {
    const { handle, onResizeEnd, unmount } = renderHandle()
    fireEvent.mouseDown(handle, { button: 0, clientX: 0 })
    fireEvent.mouseMove(window, { button: 0, clientX: 30 })
    expect(onResizeEnd).not.toHaveBeenCalled()

    // The pinned header can unmount under the cursor; without the cleanup the drag never ends.
    unmount()
    expect(onResizeEnd).toHaveBeenCalledTimes(1)
  })

  it("keeps the drag's trailing click away from the header's sort handler", () => {
    const onParentClick = jest.fn()
    render(
      // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stands in for the th's sort handler
      <div onClick={onParentClick}>
        <ColumnResizeHandle
          columnId="student"
          getWidth={() => START_WIDTH}
          minWidth={MIN_COLUMN_WIDTH}
          maxWidth={MAX_COLUMN_WIDTH}
          label="Resize column Student"
          presentational={false}
          onResizeStart={jest.fn()}
          onResize={jest.fn()}
          onResizeEnd={jest.fn()}
          onReset={jest.fn()}
        />
      </div>,
    )
    fireEvent.click(screen.getByTestId(RESIZE_HANDLE_TESTID))
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it("exposes a slider on the real header and nothing at all on the pinned clone", () => {
    const { unmount } = renderHandle()
    expect(screen.getByRole("slider")).toHaveAttribute("aria-label", "Resize column Student")
    unmount()

    renderHandle({ presentational: true })
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    const clone = screen.getByTestId(RESIZE_HANDLE_TESTID)
    expect(clone).not.toHaveAttribute("tabindex")
    expect(clone).not.toHaveAttribute("aria-label")
  })
})
