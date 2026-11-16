"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import ExamStatusAnnouncer from "../ExamStatusAnnouncer"

describe("ExamStatusAnnouncer", () => {
  it("mounts an empty status region before any text", () => {
    render(<ExamStatusAnnouncer secondsLeft={3600} announceStarted={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("")
  })

  it("announces the time left once at 10 minutes and once at 1 minute", () => {
    const { rerender } = render(<ExamStatusAnnouncer secondsLeft={700} announceStarted={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("")

    rerender(<ExamStatusAnnouncer secondsLeft={598} announceStarted={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("time-left minutes")

    rerender(<ExamStatusAnnouncer secondsLeft={593} announceStarted={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("time-left minutes")

    rerender(<ExamStatusAnnouncer secondsLeft={58} announceStarted={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("time-left minutes")
  })

  it("announces that the exam started", () => {
    render(<ExamStatusAnnouncer secondsLeft={3600} announceStarted />)
    expect(screen.getByRole("status")).toHaveTextContent("exam-started")
  })
})
