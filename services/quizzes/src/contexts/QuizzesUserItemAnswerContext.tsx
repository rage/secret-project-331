import { UserAnswer } from "../../types/quizTypes/answer"
import { createExerciseServiceContext } from "../shared-module/contexts/ExerciseServiceContext"

const QuizzesUserItemAnswerContext = createExerciseServiceContext<UserAnswer>(() => false)

export default QuizzesUserItemAnswerContext
