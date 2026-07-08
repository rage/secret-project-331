import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
    const { container } = render(<IframeView maxWidth={500} />)
    expect(container.firstChild).not.toBeNull()
    // Readiness lets the parent transfer the MessagePort.
    expect(postMessageSpy).toHaveBeenCalledWith("ready", "*")
  })
})
