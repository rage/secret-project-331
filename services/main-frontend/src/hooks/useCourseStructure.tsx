"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"

import { getCourseStructure as getCourseStructureFromApi } from "@/generated/api/sdk.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_COURSE_STRUCTURE_QUERY_KEY = "getCourseStructure"

const getCourseStructureQueryOptions = (courseId: string | null | undefined) =>
  queryOptions({
    queryKey: [{ _id: GET_COURSE_STRUCTURE_QUERY_KEY, path: { course_id: courseId } }] as const,
    queryFn: () =>
      getCourseStructureFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
      }),
  })

export const useCourseStructure = (courseId: string | null) => {
  const getCourseStructure = useQuery({
    ...getCourseStructureQueryOptions(courseId),
    enabled: !!courseId,
  })

  return getCourseStructure
}
