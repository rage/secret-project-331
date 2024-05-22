import { UserAnswer } from "../../types/quizTypes/answer"

import { createExerciseServiceContext } from "@/shared-module/common/contexts/ExerciseServiceContext"

const QuizzesUserItemAnswerContext = createExerciseServiceContext<UserAnswer>(() => false)

export default QuizzesUserItemAnswerContext
