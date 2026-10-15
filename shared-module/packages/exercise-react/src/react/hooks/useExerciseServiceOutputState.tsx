"use client"

import { useCallback, useContext, useMemo } from "react"

import type { UpdateFunction } from "@/shared-module/exercise-client/client/outputState"
import {
  applyOutputStateUpdate,
  postCurrentStateMessage,
} from "@/shared-module/exercise-client/client/outputState"

import type { ExerciseServiceContextType } from "../contexts/ExerciseServiceContext"

export type { UpdateFunction }

interface UseExerciseServiceOutputStateReturn<SelectorReturnType> {
  selected: SelectorReturnType | null
  updateState: (func: UpdateFunction<SelectorReturnType>) => void
}

/**
 * Thin React wrapper over the framework-agnostic output-state helpers. Reads the current
 * output state from the exercise-service context and, on update, applies the immer-based
 * change, posts a `current-state` message to the parent, and stores the result back in the
 * context.
 */
const useExerciseServiceOutputState = <OutputType, SelectorReturnType>(
  context: ExerciseServiceContextType<OutputType>,
  selector: (arg: OutputType | null) => SelectorReturnType | null,
  wrapper?: string,
): UseExerciseServiceOutputStateReturn<SelectorReturnType> => {
  const { outputState, port, _rawSetOutputState, validate, getValidityMessages } =
    useContext(context)

  const updateState = useCallback(
    (func: UpdateFunction<SelectorReturnType>) => {
      if (!port) {
        return
      }

      if (!validate) {
        return
      }

      const nextState = applyOutputStateUpdate(outputState, selector, func)
      postCurrentStateMessage(
        port,
        nextState,
        validate(nextState),
        wrapper,
        getValidityMessages?.(nextState),
      )
      _rawSetOutputState(nextState)
    },
    [_rawSetOutputState, outputState, port, selector, validate, getValidityMessages, wrapper],
  )

  const selected = useMemo(() => selector(outputState), [outputState, selector])

  return { selected, updateState }
}

export default useExerciseServiceOutputState
