import { PrivateSpecQuiz } from "../../types/quizTypes"
import { createExerciseServiceContext } from "../shared-module/contexts/ExerciseServiceContext"

const QuizzesExerciseServiceContext = createExerciseServiceContext<PrivateSpecQuiz>()

export default QuizzesExerciseServiceContext
