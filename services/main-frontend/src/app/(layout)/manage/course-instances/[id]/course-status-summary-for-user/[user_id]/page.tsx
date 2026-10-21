"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { getCourseInstanceOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, ErrorNotice, LoadingRegion } from "@/shared-module/components"

const CourseInstanceStatusSummaryRedirect: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { id: courseInstanceId, user_id } = useParams<{ id: string; user_id: string }>()
  const courseInstanceQuery = useQuery({
    ...getCourseInstanceOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })

  useEffect(() => {
    if (courseInstanceQuery.data?.course_id && user_id) {
      router.replace(courseUserStatusSummaryRoute(courseInstanceQuery.data.course_id, user_id))
    }
  }, [courseInstanceQuery.data?.course_id, user_id, router])

  if (courseInstanceQuery.isError) {
    return <ErrorNotice error={courseInstanceQuery.error} />
  }
  if (courseInstanceQuery.isLoading) {
    return <LoadingRegion />
  }
  if (!courseInstanceQuery.data) {
    return (
      <div>
        <ErrorNotice error={t("label-error-loading", { ns: "errors" })} />
        <Button
          variant="primary"
          onClick={() => {
            void courseInstanceQuery.refetch()
          }}
        >
          {t("button-text-try-again")}
        </Button>
      </div>
    )
  }
  return <LoadingRegion />
}

export default withErrorBoundary(withSignedIn(CourseInstanceStatusSummaryRedirect))
