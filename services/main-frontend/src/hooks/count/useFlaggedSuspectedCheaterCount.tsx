"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseFlaggedSuspectedCheatersCountOptions } from "@/generated/api/@tanstack/react-query.generated"

const createFlaggedSuspectedCheaterCountHook = (courseId: string) => {
  const useFlaggedSuspectedCheaterCount = () => {
    return useQuery({
      ...getCourseFlaggedSuspectedCheatersCountOptions({
        path: {
          course_id: courseId,
        },
      }),
    })
  }
  return useFlaggedSuspectedCheaterCount
}

export default createFlaggedSuspectedCheaterCountHook
