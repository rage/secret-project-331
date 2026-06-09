"use client"

import { UserAnswer } from "../../types/quizTypes/answer"

import { createExerciseServiceContext } from "@/shared-module/exercise-plugins/react/contexts/ExerciseServiceContext"

const QuizzesUserItemAnswerContext = createExerciseServiceContext<UserAnswer>(() => false)

export default QuizzesUserItemAnswerContext
