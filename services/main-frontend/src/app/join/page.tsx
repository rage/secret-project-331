"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseBreadcrumbInfoOptions,
  getCourseByJoinCodeOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { joinCourseWithJoinCode } from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { navigateToCourseRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const JoinCoursePage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const joinCode = searchParams.get("code")

  const course = useQuery(
    optionalGeneratedQueryOptions({
      value: joinCode,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseByJoinCodeOptions({
          path: {
            join_code: value,
          },
        }),
    }),
  )

  const courseId = course.data?.id

  const courseBreadcrumbs = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: false,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseBreadcrumbInfoOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )

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
      await joinCourseWithJoinCode({
        body: {
          join_code: joinCode ?? "",
        },
        path: {
          course_id: courseId,
        },
      })
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        await courseBreadcrumbs.refetch()
      },
    },
  )

  const handleReturn = () => {
    router.push("/")
  }
  return (
    <div>
      {joinCode && (
        <QueryResult query={course}>
          {(courseData) => (
            <div>
              <h1>{courseData.name}</h1>

              <div>{t("do-you-want-to-join-this-course")}?</div>
              <Button
                variant={"primary"}
                size={"small"}
                onClick={() => handleRedirectMutation.mutate(courseData.id)}
              >
                {t("yes")}
              </Button>
              <Button variant={"secondary"} size={"small"} onClick={handleReturn}>
                {t("button-text-cancel")}
              </Button>
            </div>
          )}
        </QueryResult>
      )}
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(JoinCoursePage)))
