"use client"

import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// A render smoke test only needs a translation stub, not a real i18n instance.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  Translation: ({ children }: { children: (t: (key: string) => string) => ReactNode }) =>
    children((key) => key),
}))

import IframeView from "./IframeView"

describe("<IframeView /> (exercise iframe)", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // The handshake calls parent.postMessage("ready", "*"). In jsdom parent === window.
    postMessageSpy = vi.spyOn(window.parent, "postMessage")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("mounts and posts the 'ready' handshake to the parent", () => {
    const { container } = render(<IframeView />)
    // It rendered without crashing.
    expect(container.firstChild).not.toBeNull()
    // It announced readiness so the parent will transfer the MessagePort.
    expect(postMessageSpy).toHaveBeenCalledWith("ready", "*")
  })
})
