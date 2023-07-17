import { Draft } from "immer"

import { UserAnswer } from "../../types/quizTypes/answer"
import QuizzesUserItemAnswerContext from "../contexts/QuizzesUserItemAnswerContext"
import useExerciseServiceOutputState from "../shared-module/hooks/exerciseServiceHooks/useExerciseServiceOutputState"

const useQuizzesUserAnswerOutputState = <SelectorReturnType,>(
  selector: (arg: UserAnswer | null) => Draft<SelectorReturnType> | null,
) => {
  return useExerciseServiceOutputState(QuizzesUserItemAnswerContext, selector)
}

export default useQuizzesUserAnswerOutputState
