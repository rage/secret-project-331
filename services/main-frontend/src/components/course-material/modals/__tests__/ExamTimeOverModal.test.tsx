"use client"

import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"

import ExamTimeOverModal from "../ExamTimeOverModal"

describe("ExamTimeOverModal", () => {
  it("stays closed after Escape while secondsLeft keeps changing", () => {
    const onClose = jest.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <ExamTimeOverModal disabled={false} secondsLeft={0} onClose={onClose} />,
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)

    for (const seconds of [-5, -10, -15]) {
      act(() => {
        rerender(<ExamTimeOverModal disabled={false} secondsLeft={seconds} onClose={onClose} />)
      })
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    }
  })

  it("is not shown while time remains", () => {
    render(<ExamTimeOverModal disabled={false} secondsLeft={30} onClose={jest.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
