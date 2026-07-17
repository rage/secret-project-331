import useExerciseServiceOutputState from "@/shared-module/exercise-react/react/hooks/useExerciseServiceOutputState"

import type { UserAnswer } from "../../types/quizTypes/answer"
import QuizzesUserItemAnswerContext from "../contexts/QuizzesUserItemAnswerContext"

const useQuizzesUserAnswerOutputState = <SelectorReturnType,>(
  selector: (arg: UserAnswer | null) => SelectorReturnType | null,
) => {
  return useExerciseServiceOutputState(QuizzesUserItemAnswerContext, selector)
}

export default useQuizzesUserAnswerOutputState
