import { UserAnswer } from "../../types/quizTypes/answer"
import { createExerciseServiceContext } from "../shared-module/contexts/ExerciseServiceContext"

const QuizzesUserItemAnswerContext = createExerciseServiceContext<UserAnswer>()

export default QuizzesUserItemAnswerContext
