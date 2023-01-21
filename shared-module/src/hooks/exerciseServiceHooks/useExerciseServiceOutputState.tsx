import produce, { Draft } from "immer"
import { useContext } from "react"

import { ExerciseServiceContextType } from "../../contexts/ExerciseServiceContext"
import { CurrentStateMessage } from "../../exercise-service-protocol-types"

type UpdateFunction<R> = (draftState: Draft<R | null>) => void

const useExerciseServiceOutputState = <OutputType, SelectorReturnType>(
  context: ExerciseServiceContextType<OutputType>,
  selector: (arg: OutputType | null) => Draft<SelectorReturnType> | null,
) => {
  const { outputState, port, _rawSetOutputState } = useContext(context)

  const updateState = (func: UpdateFunction<SelectorReturnType>) => {
    if (!port) {
      return
    }

    const nextState = produce(outputState, (draft) => {
      const selected = selector(draft as OutputType)
      func(selected)
    })

    const message: CurrentStateMessage = {
      data: nextState,
      // eslint-disable-next-line i18next/no-literal-string
      message: "current-state",
      valid: true,
    }
    port.postMessage(message)
    _rawSetOutputState(nextState)
  }

  const selected = selector(outputState)

  return { selected, updateState }
}

export default useExerciseServiceOutputState
