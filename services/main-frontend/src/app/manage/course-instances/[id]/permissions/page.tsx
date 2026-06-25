"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { PermissionPage } from "@/components/PermissionPage"
import { getCourseInstanceOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const CourseInstancePermissions: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const courseInstance = useQuery({
    ...getCourseInstanceOptions({
      path: {
        course_instance_id: id,
      },
    }),
  })

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      <QueryResult query={courseInstance}>
        {(data) => (
          <>
            <h1>
              {t("roles-for-course-instance")} {data.name}
            </h1>
            <PermissionPage
              domain={{
                // eslint-disable-next-line i18next/no-literal-string
                tag: "CourseInstance",
                id: data.id,
              }}
            />
          </>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CourseInstancePermissions))
