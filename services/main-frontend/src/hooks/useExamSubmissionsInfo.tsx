"use client"

import { useQuery } from "@tanstack/react-query"

import { getExamSubmissionsWithExerciseIdOptions } from "../services/backend/exams"

const useExamSubmissionsInfo = (exercise_id: string, pageNumber: number, pageLimit: number) => {
  return useQuery(getExamSubmissionsWithExerciseIdOptions(exercise_id, pageNumber, pageLimit))
}

export default useExamSubmissionsInfo
