import { createExerciseServiceContext } from "@/shared-module/exercise-react/react/contexts/ExerciseServiceContext"

import type { UserAnswer } from "../../types/quizTypes/answer"

const QuizzesUserItemAnswerContext = createExerciseServiceContext<UserAnswer>(() => false)

export default QuizzesUserItemAnswerContext
