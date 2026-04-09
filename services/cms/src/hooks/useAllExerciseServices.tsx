"use client"

import { useQuery } from "@tanstack/react-query"

import { getAllExerciseServicesOptions } from "../services/backend/exercise-services"

const useAllExerciseServices = () => {
  return useQuery(getAllExerciseServicesOptions())
}

export default useAllExerciseServices
