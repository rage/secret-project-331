import { setExerciseServiceReloadBridge } from "../../src/utils/iframeReloadBridge"

describe("setExerciseServiceReloadBridge", () => {
  afterEach(() => {
    delete (global as { window?: unknown }).window
  })

  test("registers a global callback that posts request-iframe-reload and cleans up", () => {
    const messages: Array<unknown> = []
    ;(global as { window: unknown }).window = {}

    const cleanup = setExerciseServiceReloadBridge({
      postMessage: (message: unknown) => {
        messages.push(message)
      },
    } as unknown as MessagePort)

    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }

    expect(typeof anyWindow.__exerciseServiceRequestReload).toBe("function")
    anyWindow.__exerciseServiceRequestReload?.()
    expect(messages).toEqual([{ message: "request-iframe-reload" }])

    cleanup()
    expect(anyWindow.__exerciseServiceRequestReload).toBeUndefined()
  })
})
