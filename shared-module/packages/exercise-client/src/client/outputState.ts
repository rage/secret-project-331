// Framework-agnostic exercise output-state management.
//
// This is the reusable substrate behind the React `useExerciseServiceOutputState` hook: it
// applies an immer-based immutable update through a selector and posts the resulting
// `current-state` message to the parent. The pure helpers (`applyOutputStateUpdate`,
// `postCurrentStateMessage`) are used directly by the React hook (which keeps its state in a
// context), while `createOutputStateEngine` is a small stateful wrapper for non-React adapters.

import { produce } from "immer"

import type { CurrentStateMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

export type UpdateFunction<R> = (draftState: R | null) => void

/**
 * Produce the next output state by running `func` against the slice that `selector` picks out
 * of an immer draft of `current`. The selected value is itself a draft (a subset of the
 * draft tree), so mutating it mutates the produced state.
 */
export function applyOutputStateUpdate<OutputType, SelectorReturnType>(
  current: OutputType | null,
  selector: (arg: OutputType | null) => SelectorReturnType | null,
  func: UpdateFunction<SelectorReturnType>,
): OutputType | null {
  return produce(current, (draft) => {
    const selected = selector(draft as OutputType)
    func(selected)
  })
}

/** Post a `current-state` message with the given state, optionally wrapped under a key. */
export function postCurrentStateMessage(
  port: MessagePort,
  nextState: unknown,
  valid: boolean,
  wrapper?: string,
  validityMessages?: string[],
): void {
  const message: CurrentStateMessage = {
    data: wrapper ? { [wrapper]: nextState } : nextState,
    message: "current-state",
    valid,
    ...(validityMessages && validityMessages.length > 0 ? { validityMessages } : {}),
  }
  port.postMessage(message)
}

export interface OutputStateEngine<OutputType> {
  getState: () => OutputType | null
  /** Replace the state without posting a message. */
  setState: (state: OutputType | null) => void
  /** Set (or clear) the port that `current-state` messages are posted to. */
  setPort: (port: MessagePort | null) => void
  /**
   * Apply an update via a selector + draft mutation, post the resulting `current-state`
   * message (with validity computed from `validate`), and store the new state.
   * No-op (returns the unchanged state) if no port is set.
   */
  update: <SelectorReturnType>(
    selector: (arg: OutputType | null) => SelectorReturnType | null,
    func: UpdateFunction<SelectorReturnType>,
    options?: { wrapper?: string },
  ) => OutputType | null
}

export interface OutputStateEngineOptions<OutputType> {
  port?: MessagePort | null
  validate: (state: OutputType | null) => boolean
  /** Optional already-localized reasons the state is not yet submittable; sent with `current-state`. */
  getValidityMessages?: (state: OutputType | null) => string[]
  initialState?: OutputType | null
  /** Notified whenever the state changes (lets adapters mirror it into their own store). */
  onState?: (state: OutputType | null) => void
}

/**
 * Create a stateful output-state controller for non-React adapters (the React hook uses the
 * pure helpers above directly, since it stores state in a context).
 */
export function createOutputStateEngine<OutputType>(
  options: OutputStateEngineOptions<OutputType>,
): OutputStateEngine<OutputType> {
  let state: OutputType | null = options.initialState ?? null
  let port: MessagePort | null = options.port ?? null

  return {
    getState: () => state,
    setState(next) {
      state = next
      options.onState?.(next)
    },
    setPort(next) {
      port = next
    },
    update(selector, func, updateOptions) {
      if (!port) {
        return state
      }
      const nextState = applyOutputStateUpdate(state, selector, func)
      postCurrentStateMessage(
        port,
        nextState,
        options.validate(nextState),
        updateOptions?.wrapper,
        options.getValidityMessages?.(nextState),
      )
      state = nextState
      options.onState?.(nextState)
      return nextState
    },
  }
}
