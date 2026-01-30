"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import {
  addUserToCourseWithJoinCode,
  fetchCourseWithJoinCode,
  getCourseBreadCrumbInfo,
} from "@/services/backend/courses"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { navigateToCourseRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

const JoinCoursePage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const joinCode = searchParams.get("code")

  const course = useQuery({
    queryKey: [`/courses/join/${joinCode}/`, joinCode],
    queryFn: () => fetchCourseWithJoinCode(joinCode ?? ""),
  })

  const courseId = course.data?.id

  const courseBreadcrumbs = useQuery({
    queryKey: [`/courses/${courseId}/breadcrumb-info`, courseId],
    queryFn: () => getCourseBreadCrumbInfo(courseId ?? ""),
    enabled: false,
  })

  useEffect(() => {
    if (
      courseBreadcrumbs.isSuccess &&
      courseBreadcrumbs.data?.organization_slug &&
      courseBreadcrumbs.data?.course_slug
    ) {
      router.push(
        navigateToCourseRoute(
          courseBreadcrumbs.data.organization_slug,
          courseBreadcrumbs.data.course_slug,
        ),
      )
    }
  }, [
    courseBreadcrumbs.data?.course_slug,
    courseBreadcrumbs.data?.organization_slug,
    courseBreadcrumbs.isSuccess,
    router,
  ])

  const handleRedirectMutation = useToastMutation(
    async (courseId: string) => {
      await addUserToCourseWithJoinCode(courseId)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        await courseBreadcrumbs.refetch()
        console.log(courseBreadcrumbs.isSuccess)
      },
    },
  )

  const handleReturn = () => {
    router.push("/")
  }
  return (
    <div>
      {course.isError && <ErrorBanner variant={"readOnly"} error={courseBreadcrumbs.error} />}
      {course.isLoading && <Spinner variant={"medium"} />}
      {course.isSuccess && (
        <div>
          <h1>{course.data.name}</h1>

          <div>{t("do-you-want-to-join-this-course")}?</div>
          <Button
            variant={"primary"}
            size={"small"}
            onClick={() => handleRedirectMutation.mutate(course.data?.id)}
          >
            {t("yes")}
          </Button>
          <Button variant={"secondary"} size={"small"} onClick={handleReturn}>
            {t("button-text-cancel")}
          </Button>
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(JoinCoursePage)))
