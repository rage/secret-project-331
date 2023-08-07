import React from "react"

export interface ContextProps {
  answers: { [key: string]: boolean } | undefined
  setAnswers: (answers: { [key: string]: boolean }) => void
}

export const CheckboxContext = React.createContext<ContextProps>({
  answers: {},
  setAnswers: () => {
    throw new Error("setAnswers called outside provider.")
  },
})
