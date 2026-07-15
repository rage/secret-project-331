"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import { PermissionPage } from "@/components/PermissionPage"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { QueryResult } from "@/shared-module/components"

const CoursePermissions: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const course = useCourseQuery(courseId)

  return (
    <div>
      <QueryResult query={course}>
        {(courseData) => (
          <>
            <h1
              className={css`
                font-size: clamp(2rem, 3.6vh, 36px);
                color: ${baseTheme.colors.gray[700]};
                font-family: ${headingFont};
                font-weight: bold;
              `}
            >
              {t("roles-for-course")} {courseData.name}
            </h1>
            <PermissionPage
              domain={{
                // oxlint-disable-next-line i18next/no-literal-string
                tag: "Course",
                id: courseData.id,
              }}
            />
          </>
        )}
      </QueryResult>
    </div>
  )
}

export default CoursePermissions
