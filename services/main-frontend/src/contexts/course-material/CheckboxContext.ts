import React from "react"

export interface ContextProps {
  questionIdsAndAnswers: { [key: string]: boolean } | undefined
  setQuestionIdsAndAnswers: (questionIdsAndAnswers: { [key: string]: boolean }) => void
}

export const CheckboxContext = React.createContext<ContextProps>({
  questionIdsAndAnswers: {},
  setQuestionIdsAndAnswers: () => {
    throw new Error("setAnswers called outside provider.")
  },
})
