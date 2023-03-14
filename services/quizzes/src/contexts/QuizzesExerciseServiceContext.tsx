import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import { createExerciseServiceContext } from "../shared-module/contexts/ExerciseServiceContext"

const QuizzesExerciseServiceContext = createExerciseServiceContext<PrivateSpecQuiz>()

export default QuizzesExerciseServiceContext
