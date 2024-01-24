import React from "react"

interface ExerciseServiceContextProps<T> {
  outputState: T | null
  port: MessagePort | null
  validate: (newState: T | null) => boolean
  _rawSetOutputState: (newValue: T | null) => void
}

export const createExerciseServiceContext = <OutputType,>(
  validate: (newState: OutputType | null) => boolean,
) => {
  return React.createContext<ExerciseServiceContextProps<OutputType>>({
    outputState: null,
    port: null,
    _rawSetOutputState: () => {
      /* NOP */
    },
    validate,
  })
}

export type ExerciseServiceContextType<OutputType> = ReturnType<
  typeof createExerciseServiceContext<OutputType>
>
