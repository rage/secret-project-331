import { render } from "@testing-library/react"
import { vi } from "vitest"

import IframeView from "./IframeView"

type Handler = (data: unknown, port: MessagePort) => void
const captured: { handler: Handler | null } = { handler: null }

vi.mock("@/shared-module/exercise-react/react/hooks/useExerciseServiceParentConnection", () => ({
  default: (handler: Handler) => {
    captured.handler = handler
    return null
  },
}))

describe("IframeView set-language", () => {
  it("sets the document language to the parent's language", () => {
    render(<IframeView />)
    const port = { postMessage: vi.fn(), addEventListener: vi.fn() } as unknown as MessagePort
    captured.handler?.({ message: "set-language", data: "en" }, port)
    expect(document.documentElement.lang).toBe("en")
  })
})
