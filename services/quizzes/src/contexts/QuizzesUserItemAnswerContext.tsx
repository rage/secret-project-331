import { UserAnswer } from "../../types/quizTypes/answer"

import { createExerciseServiceContext } from "@/shared-module/exercise-react/react/contexts/ExerciseServiceContext"

const QuizzesUserItemAnswerContext = createExerciseServiceContext<UserAnswer>(() => false)

export default QuizzesUserItemAnswerContext
