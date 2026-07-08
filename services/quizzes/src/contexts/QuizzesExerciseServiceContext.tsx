import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

import { createExerciseServiceContext } from "@/shared-module/exercise-react/react/contexts/ExerciseServiceContext"

const QuizzesExerciseServiceContext = createExerciseServiceContext<PrivateSpecQuiz>(() => false)

export default QuizzesExerciseServiceContext
