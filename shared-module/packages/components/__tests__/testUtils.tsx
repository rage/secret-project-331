"use client"

/* eslint-disable i18next/no-literal-string */

import { fireEvent, render } from "@testing-library/react"
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
}

export function pointerPress(element: Element) {
  fireEvent.pointerDown(element)
  fireEvent.pointerUp(element)
}
