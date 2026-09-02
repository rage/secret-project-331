/**
 * @jest-environment node
 */
"use client"

import { renderToString } from "react-dom/server"

import {
  DialogProvider,
  NO_DOCUMENT_ERROR,
  useDialog,
} from "../src/components/dialogProvider/DialogProvider"

function ServerCaller() {
  const { confirm } = useDialog()
  void confirm("Sure?")
  return null
}

describe("DialogProvider on the server", () => {
  test("renders its children and no dialog markup", () => {
    const html = renderToString(
      <DialogProvider>
        <p>Page content</p>
      </DialogProvider>,
    )

    expect(html).toContain("Page content")
    expect(html).not.toContain("dialog")
  })

  test("throws when a dialog is requested there, rather than returning a promise that never settles", () => {
    expect(() =>
      renderToString(
        <DialogProvider>
          <ServerCaller />
        </DialogProvider>,
      ),
    ).toThrow(NO_DOCUMENT_ERROR)
  })
})
