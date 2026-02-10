"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { fetchCourseInstance } from "@/services/backend/course-instances"
import {
  manageCourseInstancesRoute,
  manageCourseRoute,
  organizationFrontPageRoute,
} from "@/shared-module/common/utils/routes"

export default function CourseInstanceLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()

  const courseInstanceQuery = useQuery({
    queryKey: ["course-instance", id],
    queryFn: () => fetchCourseInstance(id),
  })

  const courseId = courseInstanceQuery.data?.course_id ?? null
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
            label: t("link-course-instances"),
            href: manageCourseInstancesRoute(courseId),
          }
        : { isLoading: true as const },
      courseInstanceQuery.data?.name
        ? {
            isLoading: false as const,
            label: courseInstanceQuery.data.name,
            href: `/manage/course-instances/${id}`,
          }
        : { isLoading: true as const },
    ],
    [
      courseBreadcrumbInfo.data?.organization_slug,
      courseBreadcrumbInfo.data?.organization_name,
      courseBreadcrumbInfo.data?.course_name,
      courseId,
      courseInstanceQuery.data?.name,
      id,
      t,
    ],
  )

  useRegisterBreadcrumbs({ key: `course-instance:${id}`, order: 20, crumbs })

  return <>{children}</>
}
