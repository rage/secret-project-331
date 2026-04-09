"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialGlossary } from "@/generated/course-material-api/sdk.generated"

interface UseGlossaryOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_GLOSSARY_QUERY_KEY = "courseMaterialGlossary"

const useGlossary = (
  courseId: string | null | undefined,
  exam: unknown,
  isMaterialPage: boolean,
  options: UseGlossaryOptions = {},
) => {
  const { enabled = true } = options
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_GLOSSARY_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialGlossary({
            path: {
              course_id: courseId,
            },
            throwOnError: true,
          })
      : skipToken,
    enabled: Boolean(courseId) && exam === null && isMaterialPage && enabled,
  })
  return query
}

export default useGlossary
