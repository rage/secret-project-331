"use client"

import { useQuery } from "@tanstack/react-query"

import { getCmsExerciseServicesOptions } from "@/generated/api/@tanstack/react-query.generated"

const useAllExerciseServices = () => {
  return useQuery(getCmsExerciseServicesOptions())
}

export default useAllExerciseServices
