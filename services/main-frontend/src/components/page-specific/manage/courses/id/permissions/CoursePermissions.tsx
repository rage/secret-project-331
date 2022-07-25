import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { getCourse } from "../../../../../../services/backend/courses"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"
import { PermissionPage } from "../../../../../PermissionPage"

const CoursePermissions: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const course = useQuery([`course-${courseId}-permissions`], () => getCourse(courseId))

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      {course.isLoading && <Spinner variant="medium" />}
      {course.isError && <ErrorBanner variant="readOnly" error={course.error} />}
      {course.isSuccess && (
        <>
          <h1>
            {t("roles-for-course")} {course.data.name}
          </h1>
          <PermissionPage
            domain={{
              // eslint-disable-next-line i18next/no-literal-string
              tag: "Course",
              id: course.data.id,
            }}
          />
        </>
      )}
    </div>
  )
}

export default CoursePermissions
