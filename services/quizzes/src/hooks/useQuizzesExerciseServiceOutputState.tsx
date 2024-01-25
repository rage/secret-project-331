import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import QuizzesExerciseServiceContext from "../contexts/QuizzesExerciseServiceContext"
import useExerciseServiceOutputState from "../shared-module/common/hooks/exerciseServiceHooks/useExerciseServiceOutputState"

const PRIVATE_SPEC = "private_spec"

const useQuizzesExerciseServiceOutputState = <SelectorReturnType,>(
  selector: (arg: PrivateSpecQuiz | null) => SelectorReturnType | null,
) => {
  return useExerciseServiceOutputState(QuizzesExerciseServiceContext, selector, PRIVATE_SPEC)
}

export default useQuizzesExerciseServiceOutputState
