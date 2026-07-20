"use client"

import { render } from "@testing-library/react"
import { StrictMode } from "react"

import CommitMarker from "../CommitMarker"

describe("CommitMarker", () => {
  test("calls onCommit once on mount", () => {
    const onCommit = jest.fn()

    render(<CommitMarker onCommit={onCommit} />)

    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  test("invokes onCommit for each mount under StrictMode", () => {
    const onCommit = jest.fn()

    render(
      <StrictMode>
        <CommitMarker onCommit={onCommit} />
      </StrictMode>,
    )

    expect(onCommit).toHaveBeenCalledTimes(2)
  })
})
