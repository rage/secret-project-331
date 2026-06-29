// Framework-agnostic exercise-service client.
//
// Composes the three engines (parent connection, height observer, output state) into a single
// small façade that a non-React (vanilla JS, and later e.g. Svelte) exercise iframe can use
// directly — no React, emotion, or i18next required. The React adapter does not use this
// façade; it wraps the individual engines via hooks instead.

import { HeightObserver, observeHeight } from "./heightObserver"
import { createOutputStateEngine, OutputStateEngine } from "./outputState"
import { createParentConnection } from "./parentConnection"

import {
  forgivingIsSetStateMessage,
  SetStateMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isSetLanguageMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"

export interface ExerciseClient<TOutput> {
  /** The received `MessagePort`, or `null` until the handshake completes. */
  readonly port: MessagePort | null
  /** Resolves with the port once the parent completes the handshake. */
  readonly ready: Promise<MessagePort>
  /** Validated output-state controller; posts `current-state` to the parent on update. */
  readonly output: OutputStateEngine<TOutput>
  /** Register a handler for `set-state` messages (initial state and updates). */
  onSetState(handler: (message: SetStateMessage) => void): void
  /** Register a handler for `set-language` messages; receives the language code. */
  onSetLanguage(handler: (language: string) => void): void
  /** Register a handler for every raw message (after the typed handlers run). */
  onMessage(handler: (data: unknown) => void): void
  /** Start tracking `element`'s height and posting `height-changed`. Returns a disposer. */
  trackHeightOf(element: HTMLElement): () => void
  /** Tear down the connection and all height observers. */
  dispose(): void
}

export interface ExerciseClientOptions<TOutput> {
  /** Validates output state; its result becomes the `valid` flag on `current-state`. */
  validate?: (state: TOutput | null) => boolean
  initialState?: TOutput | null
}

/**
 * Create an exercise client and begin the parent handshake immediately.
 */
export function createExerciseClient<TOutput>(
  options: ExerciseClientOptions<TOutput> = {},
): ExerciseClient<TOutput> {
  const setStateHandlers = new Set<(message: SetStateMessage) => void>()
  const setLanguageHandlers = new Set<(language: string) => void>()
  const messageHandlers = new Set<(data: unknown) => void>()
  const heightObservers = new Set<HeightObserver>()

  const output = createOutputStateEngine<TOutput>({
    port: null,
    validate: options.validate ?? (() => true),
    initialState: options.initialState ?? null,
  })

  let resolveReady: (port: MessagePort) => void = () => {
    /* replaced synchronously below */
  }
  const ready = new Promise<MessagePort>((resolve) => {
    resolveReady = resolve
  })

  const connection = createParentConnection({
    onMessage: (data) => {
      if (forgivingIsSetStateMessage(data)) {
        setStateHandlers.forEach((handler) => handler(data))
      } else if (isSetLanguageMessage(data)) {
        setLanguageHandlers.forEach((handler) => handler(data.data))
      }
      messageHandlers.forEach((handler) => handler(data))
    },
  })

  connection.onPort((port) => {
    output.setPort(port)
    heightObservers.forEach((observer) => observer.setPort(port))
    resolveReady(port)
  })

  return {
    get port() {
      return connection.port
    },
    ready,
    output,
    onSetState(handler) {
      setStateHandlers.add(handler)
    },
    onSetLanguage(handler) {
      setLanguageHandlers.add(handler)
    },
    onMessage(handler) {
      messageHandlers.add(handler)
    },
    trackHeightOf(element) {
      const observer = observeHeight({ element, port: connection.port })
      heightObservers.add(observer)
      return () => {
        observer.dispose()
        heightObservers.delete(observer)
      }
    },
    dispose() {
      connection.dispose()
      heightObservers.forEach((observer) => observer.dispose())
      heightObservers.clear()
    },
  }
}
