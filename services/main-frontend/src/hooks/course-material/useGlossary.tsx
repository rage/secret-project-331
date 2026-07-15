"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialGlossaryOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseGlossaryOptions {
  enabled?: boolean
}

const useGlossary = (
  courseId: string | null | undefined,
  exam: unknown,
  isMaterialPage: boolean,
  options: UseGlossaryOptions = {},
) => {
  const { enabled = true } = options
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: exam === null && isMaterialPage && enabled,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCourseMaterialGlossaryOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )
  return query
}

export default useGlossary
