import type React from "react"

interface QueryableParent {
  querySelector: <T extends Element>(selector: string) => T | null
}

/** Assigns a value to a React ref (callback or object). */
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

/** Composes multiple refs so they all receive the same DOM node. */
export function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      setRef(ref, value)
    })
  }
}

/** Returns the first element matching `selector` under `root`, or null. */
export function findFirstMatchingChild<T extends Element>(
  root: QueryableParent | null,
  selector: string,
): T | null {
  if (!root) {
    return null
  }

  return root.querySelector<T>(selector)
}

/** Focuses the first element matching `selector` under `root`. */
export function focusFirstMatchingChild(root: QueryableParent | null, selector: string) {
  const candidate = findFirstMatchingChild<HTMLElement>(root, selector)
  candidate?.focus()
}
