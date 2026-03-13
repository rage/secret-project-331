"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { getExercise } from "@/services/backend/exercises"
import {
  manageCourseExercisesRoute,
  manageCourseRoute,
  organizationFrontPageRoute,
} from "@/shared-module/common/utils/routes"

export default function ExerciseLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()

  const exerciseQuery = useQuery({
    queryKey: ["exercise", id],
    queryFn: () => getExercise(id),
  })

  const courseId = exerciseQuery.data?.course_id ?? null
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  const crumbs = useMemo(
    () => [
      courseBreadcrumbInfo.data?.organization_name
        ? {
            isLoading: false as const,
            label: courseBreadcrumbInfo.data.organization_name,
            href: organizationFrontPageRoute(courseBreadcrumbInfo.data?.organization_slug ?? ""),
          }
        : { isLoading: true as const },
      courseBreadcrumbInfo.data?.course_name && courseId
        ? {
            isLoading: false as const,
            label: courseBreadcrumbInfo.data.course_name,
            href: manageCourseRoute(courseId),
          }
        : { isLoading: true as const },
      courseId
        ? {
            isLoading: false as const,
            label: t("link-exercises"),
            href: manageCourseExercisesRoute(courseId),
          }
        : { isLoading: true as const },
    ],
    [
      courseBreadcrumbInfo.data?.organization_slug,
      courseBreadcrumbInfo.data?.organization_name,
      courseBreadcrumbInfo.data?.course_name,
      courseId,
      t,
    ],
  )

  useRegisterBreadcrumbs({ key: `exercise:${id}`, order: 20, crumbs })

  return <>{children}</>
}
