import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import { createExerciseServiceContext } from "../shared-module/common/contexts/ExerciseServiceContext"

const QuizzesExerciseServiceContext = createExerciseServiceContext<PrivateSpecQuiz>(() => false)

export default QuizzesExerciseServiceContext
