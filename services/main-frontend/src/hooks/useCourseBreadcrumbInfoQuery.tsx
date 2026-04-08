"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseBreadCrumbInfoOptions } from "../services/backend/courses"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useCourseBreadcrumbInfoQuery = (courseId: string | null) => {
  return useQuery({
    ...getCourseBreadCrumbInfoOptions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export default useCourseBreadcrumbInfoQuery
