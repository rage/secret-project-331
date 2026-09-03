"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import StatusPodLogs from "../StatusPodLogs"

const idleQueryResult = { data: undefined, isLoading: false, error: null }

const useStatusPodLogs = jest.fn(() => idleQueryResult)

jest.mock("@/hooks/useStatusPodLogs", () => ({
  useStatusPodLogs: (...args: Parameters<typeof useStatusPodLogs>) => useStatusPodLogs(...args),
}))

jest.mock("@/hooks/useStatusPods", () => ({
  useStatusPods: () => ({
    data: [
      { name: "pod-a", labels: {}, phase: "Running" },
      { name: "pod-b", labels: {}, phase: "Running" },
    ],
    isLoading: false,
    error: null,
  }),
}))

/** Opens a Select's listbox and clicks the option with the given accessible name. */
function chooseOption(triggerName: string, optionName: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(triggerName) }))
  fireEvent.click(screen.getByRole("option", { name: optionName }))
}

describe("StatusPodLogs", () => {
  beforeEach(() => {
    useStatusPodLogs.mockClear()
  })

  it("queries no pod until one is selected, with the default tail", () => {
    render(<StatusPodLogs />)
    expect(useStatusPodLogs).toHaveBeenLastCalledWith(null, undefined, 100)
  })

  it("queries the selected pod's logs", () => {
    render(<StatusPodLogs />)
    chooseOption("status-select-pod", "pod-a")
    expect(useStatusPodLogs).toHaveBeenLastCalledWith("pod-a", undefined, 100)
  })

  it("coerces the picked tail line count from a string option to a number", () => {
    render(<StatusPodLogs />)
    chooseOption("status-select-pod", "pod-b")
    chooseOption("status-tail-lines", "500")
    expect(useStatusPodLogs).toHaveBeenLastCalledWith("pod-b", undefined, 500)
  })
})
