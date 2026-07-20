"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseStructureOptions } from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

export const useCourseStructure = (courseId: string | null) => {
  const getCourseStructure = useQuery({
    ...optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseStructureOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  })

  return getCourseStructure
}
