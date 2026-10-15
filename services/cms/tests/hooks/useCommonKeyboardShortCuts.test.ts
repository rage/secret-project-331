/**
 * @jest-environment jsdom
 */

import { shouldHandleBlockEditorHistoryShortcut } from "../../src/hooks/useCommonKeyboardShortCuts"

const keydownEventFrom = (target: Element): Event => {
  let dispatchedEvent: Event | null = null
  const listener = (event: Event) => {
    dispatchedEvent = event
  }

  target.addEventListener("keydown", listener)
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "z" }))
  target.removeEventListener("keydown", listener)

  if (dispatchedEvent === null) {
    throw new Error("The keydown event was not dispatched")
  }

  return dispatchedEvent
}

const appendToBody = (html: string): Element => {
  const container = document.createElement("div")
  container.innerHTML = html
  document.body.append(container)
  const target = container.firstElementChild

  if (target === null) {
    throw new Error("The test markup has no element")
  }

  return target
}

describe("shouldHandleBlockEditorHistoryShortcut", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("handles the shortcut outside editable fields", () => {
    const target = appendToBody(`<div><p>Not editable</p></div>`)

    expect(shouldHandleBlockEditorHistoryShortcut(keydownEventFrom(target))).toBe(true)
  })

  it("leaves the shortcut to input, textarea and select elements", () => {
    for (const html of [`<input />`, `<textarea></textarea>`, `<select></select>`]) {
      expect(shouldHandleBlockEditorHistoryShortcut(keydownEventFrom(appendToBody(html)))).toBe(
        false,
      )
    }
  })

  // Undo stays routed through the block editor store inside rich text, matching upstream Gutenberg:
  // native contenteditable undo mutates the DOM behind a controlled RichText and desyncs block state.
  it("handles the shortcut inside rich text", () => {
    const target = appendToBody(`<p contenteditable="true">Paragraph block</p>`)

    expect(shouldHandleBlockEditorHistoryShortcut(keydownEventFrom(target))).toBe(true)
  })

  it("handles the shortcut inside an explicitly non-editable element", () => {
    const target = appendToBody(`<div contenteditable="false">Read only</div>`)

    expect(shouldHandleBlockEditorHistoryShortcut(keydownEventFrom(target))).toBe(true)
  })
})
