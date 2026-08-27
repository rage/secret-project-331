import { renderHook, waitFor } from "@testing-library/react"

import { primaryFont } from "@/shared-module/common/styles"

import { useFontLoaded } from "../useFontLoaded"

const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts")

const noop = () => undefined

const setDocumentFonts = (fonts: unknown) => {
  Object.defineProperty(document, "fonts", { value: fonts, configurable: true })
}

/** A `document.fonts` stand-in whose `load` only settles once the returned `resolve` is called. */
const pendingFonts = () => {
  let resolve: () => void = noop
  const load = jest.fn(
    () =>
      new Promise<void>((res) => {
        resolve = res
      }),
  )
  setDocumentFonts({ load })
  return { load, resolve: () => resolve() }
}

afterEach(() => {
  if (originalFonts) {
    Object.defineProperty(document, "fonts", originalFonts)
  } else {
    // @ts-expect-error: jsdom does not necessarily define document.fonts at all.
    delete document.fonts
  }
})

describe("useFontLoaded", () => {
  it("reports not loaded until the font resolves", async () => {
    const fonts = pendingFonts()

    const { result } = renderHook(() => useFontLoaded())
    expect(result.current).toBe(false)

    fonts.resolve()
    await waitFor(() => expect(result.current).toBe(true))
  })

  it("probes the primary font by default", () => {
    const fonts = pendingFonts()

    renderHook(() => useFontLoaded())

    expect(fonts.load).toHaveBeenCalledWith(`1rem ${primaryFont}`)
  })

  it("probes the given font family", () => {
    const fonts = pendingFonts()

    renderHook(() => useFontLoaded("Comic Sans MS"))

    expect(fonts.load).toHaveBeenCalledWith("1rem Comic Sans MS")
  })

  it("reports loaded when the font fails to load", async () => {
    setDocumentFonts({ load: jest.fn(() => Promise.reject(new Error("no such font"))) })

    const { result } = renderHook(() => useFontLoaded())

    await waitFor(() => expect(result.current).toBe(true))
  })

  it("reports loaded when the browser has no font loading API", () => {
    setDocumentFonts(undefined)

    const { result } = renderHook(() => useFontLoaded())

    expect(result.current).toBe(true)
  })

  it("re-probes and resets when the font family changes", async () => {
    const load = jest.fn(() => Promise.resolve())
    setDocumentFonts({ load })

    const { result, rerender } = renderHook(({ font }) => useFontLoaded(font), {
      initialProps: { font: "First" },
    })
    await waitFor(() => expect(result.current).toBe(true))

    rerender({ font: "Second" })

    expect(load).toHaveBeenLastCalledWith("1rem Second")
    await waitFor(() => expect(result.current).toBe(true))
  })

  it("does not update state after unmounting", async () => {
    const fonts = pendingFonts()
    const errorSpy = jest.spyOn(console, "error").mockImplementation(noop)

    const { unmount } = renderHook(() => useFontLoaded())
    unmount()
    fonts.resolve()
    await Promise.resolve()

    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
