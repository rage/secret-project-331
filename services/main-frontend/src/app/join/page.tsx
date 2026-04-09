"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseBreadcrumbInfo as getCourseBreadCrumbInfoFromApi,
  getCourseByJoinCode as getCourseByJoinCodeFromApi,
  joinCourseWithJoinCode,
} from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { navigateToCourseRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

const GET_COURSE_BY_JOIN_CODE_QUERY_KEY = "getCourseByJoinCode"
const GET_COURSE_BREADCRUMB_INFO_QUERY_KEY = "getCourseBreadcrumbInfo"

const getCourseByJoinCodeQueryOptions = (joinCode: string | null) =>
  queryOptions({
    queryKey: [{ _id: GET_COURSE_BY_JOIN_CODE_QUERY_KEY, path: { join_code: joinCode } }] as const,
    queryFn: () =>
      getCourseByJoinCodeFromApi({
        path: {
          join_code: assertNotNullOrUndefined(joinCode),
        },
      }),
  })

const getCourseBreadcrumbInfoQueryOptions = (courseId: string | null | undefined) =>
  queryOptions({
    queryKey: [
      { _id: GET_COURSE_BREADCRUMB_INFO_QUERY_KEY, path: { course_id: courseId } },
    ] as const,
    queryFn: () =>
      getCourseBreadCrumbInfoFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
      }),
  })

const JoinCoursePage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const joinCode = searchParams.get("code")

  const course = useQuery({
    ...getCourseByJoinCodeQueryOptions(joinCode),
    enabled: !!joinCode,
  })

  const courseId = course.data?.id

  const courseBreadcrumbs = useQuery({
    ...getCourseBreadcrumbInfoQueryOptions(courseId),
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
      await joinCourseWithJoinCode({
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
