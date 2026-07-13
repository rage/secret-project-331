import React from "react"

export interface ContextProps {
  questionIdsAndAnswers: Record<string, boolean> | undefined
  setQuestionIdsAndAnswers: (questionIdsAndAnswers: Record<string, boolean>) => void
}

export const CheckboxContext = React.createContext<ContextProps>({
  questionIdsAndAnswers: {},
  setQuestionIdsAndAnswers: () => {
    throw new Error("setAnswers called outside provider.")
  },
})
