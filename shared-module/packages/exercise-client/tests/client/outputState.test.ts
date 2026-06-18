import {
  applyOutputStateUpdate,
  createOutputStateEngine,
  postCurrentStateMessage,
} from "../../src/client/outputState"
import { createMockMessagePort } from "../utils/iframeTestUtils"

interface Spec {
  items: Array<{ id: string; name: string }>
}

describe("applyOutputStateUpdate", () => {
  it("applies an immutable update through the selector", () => {
    const state: Spec = { items: [{ id: "a", name: "x" }] }
    const next = applyOutputStateUpdate(
      state,
      (s) => s?.items ?? null,
      (items) => {
        items?.push({ id: "b", name: "y" })
      },
    )
    expect(next?.items).toHaveLength(2)
    // original is untouched (immer)
    expect(state.items).toHaveLength(1)
  })
})

describe("postCurrentStateMessage", () => {
  it("posts an unwrapped current-state message", () => {
    const port = createMockMessagePort()
    postCurrentStateMessage(port as unknown as MessagePort, { a: 1 }, true)
    expect(port.postMessage).toHaveBeenCalledWith({
      message: "current-state",
      data: { a: 1 },
      valid: true,
    })
  })

  it("wraps the data under a key when a wrapper is given", () => {
    const port = createMockMessagePort()
    postCurrentStateMessage(port as unknown as MessagePort, { a: 1 }, false, "private_spec")
    expect(port.postMessage).toHaveBeenCalledWith({
      message: "current-state",
      data: { private_spec: { a: 1 } },
      valid: false,
    })
  })
})

describe("createOutputStateEngine", () => {
  it("updates state and posts a validated current-state message", () => {
    const port = createMockMessagePort()
    const onState = jest.fn()
    const engine = createOutputStateEngine<Spec>({
      port: port as unknown as MessagePort,
      validate: (s) => (s?.items.length ?? 0) > 0,
      initialState: { items: [] },
      onState,
    })

    const next = engine.update(
      (s) => s?.items ?? null,
      (items) => {
        items?.push({ id: "a", name: "x" })
      },
    )

    expect(next?.items).toHaveLength(1)
    expect(engine.getState()?.items).toHaveLength(1)
    expect(onState).toHaveBeenCalledWith(next)
    expect(port.postMessage).toHaveBeenCalledWith({
      message: "current-state",
      data: next,
      valid: true,
    })
  })

  it("no-ops update when no port is set", () => {
    const engine = createOutputStateEngine<Spec>({
      validate: () => true,
      initialState: { items: [] },
    })
    const next = engine.update(
      (s) => s?.items ?? null,
      (items) => {
        items?.push({ id: "a", name: "x" })
      },
    )
    expect(next?.items).toHaveLength(0)
  })

  it("posts once a port is set via setPort", () => {
    const port = createMockMessagePort()
    const engine = createOutputStateEngine<Spec>({
      validate: () => true,
      initialState: { items: [] },
    })
    engine.setPort(port as unknown as MessagePort)
    engine.update(
      (s) => s?.items ?? null,
      (items) => {
        items?.push({ id: "a", name: "x" })
      },
    )
    expect(port.postMessage).toHaveBeenCalled()
  })
})
