import { Draft } from "immer"

import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import QuizzesExerciseServiceContext from "../contexts/QuizzesExerciseServiceContext"
import useExerciseServiceOutputState from "../shared-module/hooks/exerciseServiceHooks/useExerciseServiceOutputState"

const useQuizzesExerciseServiceOutputState = <SelectorReturnType,>(
  selector: (arg: PrivateSpecQuiz | null) => Draft<SelectorReturnType> | null,
) => {
  return useExerciseServiceOutputState(QuizzesExerciseServiceContext, selector)
}

export default useQuizzesExerciseServiceOutputState
