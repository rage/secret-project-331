"use client"

/* oxlint-disable i18next/no-literal-string */

import { fireEvent, render } from "@testing-library/react"
import type React from "react"
import type { Control, DefaultValues, FieldValues, UseFormReturn } from "react-hook-form"
import { useForm } from "react-hook-form"

import "../tests/test-i18n"

export function renderUi(ui: React.ReactElement) {
  return render(ui)
}

type FormHarnessProps<T extends FieldValues> = {
  defaultValues?: DefaultValues<T>
  children: (control: Control<T>) => React.ReactElement
}

type FormHarnessCoreProps<T extends FieldValues> = FormHarnessProps<T> & {
  methodsRef?: React.MutableRefObject<UseFormReturn<T> | null>
}

/** Renders children with `useForm` control (e.g. for keyed rerenders). */
export function FormHarness<T extends FieldValues>({
  defaultValues,
  children,
}: FormHarnessProps<T>) {
  return <FormHarnessCore defaultValues={defaultValues}>{children}</FormHarnessCore>
}

function FormHarnessCore<T extends FieldValues>({
  defaultValues,
  children,
  methodsRef,
}: FormHarnessCoreProps<T>) {
  const methods = useForm<T>({ defaultValues })
  if (methodsRef) {
    methodsRef.current = methods
  }
  return <>{children(methods.control)}</>
}

export type RenderWithFormResult<T extends FieldValues> = ReturnType<typeof render> & {
  getValues: () => T
  /** Populated after first render; use for `trigger`, `setValue`, etc. */
  formRef: React.MutableRefObject<UseFormReturn<T> | null>
}

/** Renders a field subtree with react-hook-form `control` in scope. */
export function renderWithForm<T extends FieldValues>(
  renderField: (control: Control<T>) => React.ReactElement,
  options?: { defaultValues?: DefaultValues<T> },
): RenderWithFormResult<T> {
  const formRef: React.MutableRefObject<UseFormReturn<T> | null> = { current: null }
  const utils = render(
    <FormHarnessCore methodsRef={formRef} defaultValues={options?.defaultValues}>
      {renderField}
    </FormHarnessCore>,
  )
  return {
    ...utils,
    formRef,
    getValues: () => formRef.current!.getValues() as T,
  }
}

export type StringFieldForm = { f: string }
export type BooleanFieldForm = { f: boolean }

/** Renders a field backed by `{ f: string }` (default `""`). */
export function renderStringField(
  renderFn: (control: Control<StringFieldForm>) => React.ReactElement,
  defaultValue = "",
): RenderWithFormResult<StringFieldForm> {
  return renderWithForm<StringFieldForm>(renderFn, { defaultValues: { f: defaultValue } })
}

/** Renders a field backed by `{ f: boolean }` (default `false`). */
export function renderBooleanField(
  renderFn: (control: Control<BooleanFieldForm>) => React.ReactElement,
  defaultValue = false,
): RenderWithFormResult<BooleanFieldForm> {
  return renderWithForm<BooleanFieldForm>(renderFn, { defaultValues: { f: defaultValue } })
}

/** DOM `click` for tests that need `onPress`/`onClick` without `@testing-library/user-event` (pointer synthesis can throw on Jest jsdom `PointerEvent.pointerId`). */
export function domClick(element: Element) {
  fireEvent.click(element)
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
