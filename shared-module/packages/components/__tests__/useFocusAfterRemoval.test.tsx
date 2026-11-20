"use client"

import { act, render, screen } from "@testing-library/react"
import React from "react"

import { itemHeadingProps, useFocusAfterRemoval } from "../src/lib/hooks/useFocusAfterRemoval"

function List({ onFocused }: { onFocused: () => void }) {
  const [items, setItems] = React.useState(["a", "b"])
  const fallback = React.useRef<HTMLInputElement>(null)
  const { containerRef, remember } = useFocusAfterRemoval<HTMLUListElement>(items, () =>
    fallback.current?.focus(),
  )
  return (
    <>
      <ul ref={containerRef}>
        {items.map((item) => (
          <li key={item}>
            <h3 id={`h-${item}`} {...itemHeadingProps}>
              {item}
            </h3>
            <button
              type="button"
              onClick={() => {
                remember(`h-${item}`, onFocused)
                setItems((current) => current.filter((i) => i !== item))
              }}
            >
              {`Delete ${item}`}
            </button>
          </li>
        ))}
      </ul>
      <input ref={fallback} aria-label="New item" />
    </>
  )
}

describe("useFocusAfterRemoval", () => {
  test("runs onFocused after focusing the next item", () => {
    const onFocused = jest.fn(() => {
      expect(screen.getByRole("heading", { name: "b" })).toHaveFocus()
    })
    render(<List onFocused={onFocused} />)
    act(() => screen.getByRole("button", { name: "Delete a" }).click())
    expect(onFocused).toHaveBeenCalledTimes(1)
  })

  test("runs onFocused after the fallback took focus when the list ran out", () => {
    const onFocused = jest.fn()
    render(<List onFocused={onFocused} />)
    act(() => screen.getByRole("button", { name: "Delete a" }).click())
    onFocused.mockImplementation(() => {
      expect(screen.getByRole("textbox", { name: "New item" })).toHaveFocus()
    })
    act(() => screen.getByRole("button", { name: "Delete b" }).click())
    expect(onFocused).toHaveBeenCalledTimes(2)
  })
})
