/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"

await jest.unstable_mockModule("@/utils/useCmsTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {}, ready: true }),
}))

const { default: IFramePlaceHolder } = await import("../IframePlaceholder")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Sets a controlled textarea's value the way typing would, so React's onChange fires. */
function typeInto(textarea: HTMLTextAreaElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set
  setValue?.call(textarea, value)
  textarea.dispatchEvent(new Event("input", { bubbles: true }))
}

async function renderPlaceholder(setUrl: (url: string) => void, defaultValue?: string) {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  await act(() => {
    root.render(createElement(IFramePlaceHolder, { setUrl, defaultValue }))
  })

  return {
    textarea: () => container.querySelector("textarea") as HTMLTextAreaElement,
    alertText: () => container.querySelector('[role="alert"]')?.textContent,
    parse: () => act(() => container.querySelector("button")?.click()),
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

describe("IFramePlaceHolder", () => {
  it("hands a valid url to the parent", async () => {
    const setUrl = jest.fn()
    const view = await renderPlaceholder(setUrl)

    await act(() => typeInto(view.textarea(), "https://example.com/embed"))
    await view.parse()

    expect(setUrl).toHaveBeenCalledWith("https://example.com/embed")
    view.unmount()
  })

  it("extracts the src from a pasted iframe snippet", async () => {
    const setUrl = jest.fn()
    const view = await renderPlaceholder(setUrl)

    await act(() => typeInto(view.textarea(), '<iframe src="https://example.com/embed"></iframe>'))
    await view.parse()

    expect(setUrl).toHaveBeenCalledWith("https://example.com/embed")
    view.unmount()
  })

  it("rejects input that is neither a url nor an iframe snippet, without calling setUrl", async () => {
    const setUrl = jest.fn()
    const view = await renderPlaceholder(setUrl)

    await act(() => typeInto(view.textarea(), "not a url"))
    await view.parse()

    expect(setUrl).not.toHaveBeenCalled()
    expect(view.alertText()).toBe("error-parsing-failed")
  })

  it("treats an empty value as parsing failure, same as non-empty garbage", async () => {
    const setUrl = jest.fn()
    const view = await renderPlaceholder(setUrl)

    await view.parse()

    expect(setUrl).not.toHaveBeenCalled()
    expect(view.alertText()).toBe("error-parsing-failed")
  })

  it("rejects a url better handled by the embed block, without calling setUrl", async () => {
    const setUrl = jest.fn()
    const view = await renderPlaceholder(setUrl)

    await act(() => typeInto(view.textarea(), "https://www.youtube.com/watch?v=xyz"))
    await view.parse()

    expect(setUrl).not.toHaveBeenCalled()
    expect(view.alertText()).toBe("error-use-embed-block-instead")
  })
})
