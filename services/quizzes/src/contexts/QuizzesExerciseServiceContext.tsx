"use client"

import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

import { createExerciseServiceContext } from "@/shared-module/exercise-plugins/react/contexts/ExerciseServiceContext"

const QuizzesExerciseServiceContext = createExerciseServiceContext<PrivateSpecQuiz>(() => false)

export default QuizzesExerciseServiceContext
