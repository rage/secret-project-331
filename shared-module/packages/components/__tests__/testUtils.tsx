"use client"

/* eslint-disable i18next/no-literal-string */

import { fireEvent, render } from "@testing-library/react"

import "../tests/test-i18n"

export function renderUi(ui: React.ReactElement) {
  return render(ui)
}

export function pressEnter(element: Element) {
  fireEvent.keyDown(element, { key: "Enter" })
  fireEvent.keyUp(element, { key: "Enter" })
}

export function pressSpace(element: Element) {
  fireEvent.keyDown(element, { key: " " })
  fireEvent.keyUp(element, { key: " " })

  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    fireEvent.click(element)
  }
}

export function pointerPress(element: Element) {
  fireEvent.pointerDown(element)
  fireEvent.pointerUp(element)
}

export function pressArrowDown(element: Element) {
  fireEvent.keyDown(element, { key: "ArrowDown" })
}

export function pressArrowUp(element: Element) {
  fireEvent.keyDown(element, { key: "ArrowUp" })
}

export function pressTab(element: Element) {
  fireEvent.keyDown(element, { key: "Tab" })
}

export function pasteText(element: Element, text: string) {
  fireEvent.paste(element, {
    clipboardData: {
      getData: () => text,
    },
  })
}

export function changeFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  })

  fireEvent.change(input)
}
