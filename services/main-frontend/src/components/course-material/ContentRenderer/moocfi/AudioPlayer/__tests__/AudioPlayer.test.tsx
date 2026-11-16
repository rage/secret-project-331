"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"

import AudioPlayer from ".."

// The state module pulls in an ESM-only dependency that jest cannot load.
jest.mock("@/state/course-material", () => ({ courseMaterialAtom: {} }))
jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: () => ({ status: "ready" }),
}))

const Harness = () => {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <>
      <button onClick={() => setIsVisible(true)}>Listen</button>
      {isVisible && (
        <AudioPlayer
          tracks={[{ path: "x.mp3", mime: "audio/mpeg" } as never]}
          isVisible={isVisible}
          setIsVisible={() => setIsVisible(false)}
        />
      )}
    </>
  )
}

const open = () => {
  render(<Harness />)
  const listen = screen.getByRole("button", { name: "Listen" })
  listen.focus()
  fireEvent.click(listen)
  return listen
}

describe("AudioPlayer focus (B-004)", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it("returns focus to the opener when Escape closes the player", () => {
    const listen = open()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(listen)
  })

  it("returns focus to the opener when Close is pressed", () => {
    const listen = open()
    fireEvent.click(screen.getByRole("button", { name: "audio-player-close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(listen)
  })
})
