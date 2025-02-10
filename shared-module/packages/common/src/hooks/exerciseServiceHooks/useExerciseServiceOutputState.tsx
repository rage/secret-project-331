import { produce } from "immer"
import { useCallback, useContext, useMemo } from "react"

import { ExerciseServiceContextType } from "../../contexts/ExerciseServiceContext"
import { CurrentStateMessage } from "../../exercise-service-protocol-types"

export type UpdateFunction<R> = (draftState: R | null) => void

interface UseExerciseServiceOutputStateReturn<SelectorReturnType> {
  selected: SelectorReturnType | null
  updateState: (func: UpdateFunction<SelectorReturnType>) => void
}

const useExerciseServiceOutputState = <OutputType, SelectorReturnType>(
  context: ExerciseServiceContextType<OutputType>,
  selector: (arg: OutputType | null) => SelectorReturnType | null,
  wrapper?: string,
): UseExerciseServiceOutputStateReturn<SelectorReturnType> => {
  const { outputState, port, _rawSetOutputState, validate } = useContext(context)

  const updateState = useCallback(
    (func: UpdateFunction<SelectorReturnType>) => {
      if (!port) {
        return
      }

      if (!validate) {
        return
      }

      const nextState = produce(outputState, (draft) => {
        const selected = selector(draft as OutputType)
        // Selected is a draft too because it is a subset of the draft variable
        func(selected)
      })
      let message: CurrentStateMessage | null = null
      if (wrapper) {
        message = {
          data: { [wrapper]: nextState },
          // eslint-disable-next-line i18next/no-literal-string
          message: "current-state",
          valid: validate(nextState),
        }
      } else {
        message = {
          data: nextState,
          // eslint-disable-next-line i18next/no-literal-string
          message: "current-state",
          valid: validate(nextState),
        }
      }
      port.postMessage(message)
      _rawSetOutputState(nextState)
    },
    [_rawSetOutputState, outputState, port, selector, validate, wrapper],
  )

  const selected = useMemo(() => selector(outputState), [outputState, selector])

  return { selected, updateState }
}

export default useExerciseServiceOutputState
