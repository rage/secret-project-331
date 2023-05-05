import React from "react"

interface ExerciseServiceContextProps<T> {
  outputState: T | null
  port: MessagePort | null
  _rawSetOutputState: (newValue: T | null) => void
}

export const createExerciseServiceContext = <OutputType,>() => {
  return React.createContext<ExerciseServiceContextProps<OutputType>>({
    outputState: null,
    port: null,
    _rawSetOutputState: () => {
      /* NOP */
    },
  })
}

export type ExerciseServiceContextType<OutputType> = ReturnType<
  typeof createExerciseServiceContext<OutputType>
>
