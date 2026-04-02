import type React from "react"

type FormElement = HTMLInputElement | HTMLSelectElement
type QueryableParent = {
  querySelector<T extends Element>(selector: string): T | null
}

export function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return
  }

  if (typeof ref === "function") {
    ref(value)
    return
  }

  ;(ref as React.MutableRefObject<T | null>).current = value
}

export function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      setRef(ref, value)
    })
  }
}

export function syncHiddenInputValue<T extends FormElement>(input: T | null, nextValue: string) {
  if (!input) {
    return
  }

  input.value = nextValue
}

function createSyntheticChangeTarget<T extends FormElement>(input: T, nextValue: string): T {
  const eventTarget = input.cloneNode(true) as T
  syncHiddenInputValue(eventTarget, nextValue)
  return eventTarget
}

export function emitSyntheticChange<T extends FormElement>(
  input: T | null,
  onChange: ((event: React.ChangeEvent<T>) => void) | undefined,
  nextValue: string,
) {
  if (!input) {
    return
  }

  syncHiddenInputValue(input, nextValue)

  if (!onChange) {
    return
  }

  const eventTarget = createSyntheticChangeTarget(input, nextValue)

  onChange({
    currentTarget: eventTarget,
    target: eventTarget,
    type: "change",
  } as React.ChangeEvent<T>)
}

export function emitSyntheticBlur<T extends HTMLElement>(
  element: T | null,
  onBlur: ((event: React.FocusEvent<T>) => void) | undefined,
) {
  if (!element || !onBlur) {
    return
  }

  onBlur({
    currentTarget: element,
    target: element,
    relatedTarget: null,
  } as React.FocusEvent<T>)
}

export function emitSyntheticFocus<T extends HTMLElement>(
  element: T | null,
  onFocus: ((event: React.FocusEvent<T>) => void) | undefined,
) {
  if (!element || !onFocus) {
    return
  }

  onFocus({
    currentTarget: element,
    target: element,
    relatedTarget: null,
  } as React.FocusEvent<T>)
}

export function findFirstMatchingChild<T extends Element>(
  root: QueryableParent | null,
  selector: string,
): T | null {
  if (!root) {
    return null
  }

  return root.querySelector<T>(selector)
}

export function focusFirstMatchingChild(root: QueryableParent | null, selector: string) {
  const candidate = findFirstMatchingChild<HTMLElement>(root, selector)
  candidate?.focus()
}
