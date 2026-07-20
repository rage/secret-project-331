import { createExerciseServiceContext } from "@/shared-module/exercise-react/react/contexts/ExerciseServiceContext"

import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

const QuizzesExerciseServiceContext = createExerciseServiceContext<PrivateSpecQuiz>(() => false)

export default QuizzesExerciseServiceContext
