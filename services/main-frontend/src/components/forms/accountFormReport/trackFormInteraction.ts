/**
 * Coarse facts about how a form was filled in: whether any key, pointer or touch input happened and
 * how many fields were typed, pasted or filled by the browser. No positions or keys are kept, and
 * the only timing is a coarse bucket.
 */

const SECOND_BUCKETS = [0, 1, 2, 5, 10, 30, 60, 120]

export interface FormInteraction {
  keyInput: boolean
  pointerInput: boolean
  touchInput: boolean
  untrustedEvents: number
  typedFields: number
  pastedFields: number
  autofilledFields: number
  /** Fields with a value that no key, paste or browser fill explains. */
  unexplainedFields: number
  /** Seconds from the first input to now, rounded down to a coarse bucket. */
  interactionSeconds: number | null
}

export interface FormInteractionTracker {
  facts: () => FormInteraction
  detach: () => void
}

/** Starts counting on `form`. Listeners stay on the form only. */
export function trackFormInteraction(form: HTMLFormElement): FormInteractionTracker {
  const typed = new Set<string>()
  const pasted = new Set<string>()
  const autofilled = new Set<string>()
  const state = {
    keyInput: false,
    pointerInput: false,
    touchInput: false,
    untrustedEvents: 0,
    firstInputAt: null as number | null,
  }

  const noteInput = (event: Event) => {
    if (!event.isTrusted) {
      state.untrustedEvents += 1
      return false
    }
    state.firstInputAt ??= performance.now()
    return true
  }

  const listeners: [string, (event: Event) => void][] = [
    [
      "keydown",
      (event) => {
        if (noteInput(event)) {
          state.keyInput = true
        }
      },
    ],
    [
      "pointerdown",
      (event) => {
        if (noteInput(event)) {
          state.pointerInput = true
        }
      },
    ],
    [
      "touchstart",
      (event) => {
        if (noteInput(event)) {
          state.touchInput = true
        }
      },
    ],
    [
      "input",
      (event) => {
        if (!noteInput(event)) {
          return
        }
        const name = fieldName(event.target)
        if (!name) {
          return
        }
        const inputType = (event as InputEvent).inputType
        if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
          pasted.add(name)
        } else if (inputType === undefined || inputType === "insertReplacementText") {
          autofilled.add(name)
        } else {
          typed.add(name)
        }
      },
    ],
  ]
  for (const [type, listener] of listeners) {
    form.addEventListener(type, listener, { capture: true, passive: true })
  }

  return {
    facts: () => {
      const filled = Array.from(form.elements).filter(
        (element): element is HTMLInputElement =>
          element instanceof HTMLInputElement &&
          element.type !== "hidden" &&
          element.type !== "checkbox" &&
          element.type !== "radio" &&
          element.value !== "",
      )
      const explained = (element: HTMLInputElement) => {
        const name = element.name || element.id
        return typed.has(name) || pasted.has(name) || autofilled.has(name)
      }
      return {
        keyInput: state.keyInput,
        pointerInput: state.pointerInput,
        touchInput: state.touchInput,
        untrustedEvents: state.untrustedEvents,
        typedFields: typed.size,
        pastedFields: pasted.size,
        autofilledFields: autofilled.size,
        unexplainedFields: filled.filter((element) => !explained(element)).length,
        interactionSeconds:
          state.firstInputAt === null
            ? null
            : bucket((performance.now() - state.firstInputAt) / 1000),
      }
    },
    detach: () => {
      for (const [type, listener] of listeners) {
        form.removeEventListener(type, listener, { capture: true })
      }
    },
  }
}

function fieldName(target: EventTarget | null): string | null {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    ? target.name || target.id
    : null
}

function bucket(seconds: number): number {
  return SECOND_BUCKETS.filter((limit) => seconds >= limit).at(-1) ?? 0
}
