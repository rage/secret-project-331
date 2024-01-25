import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { getCourse } from "../../../../../../services/backend/courses"
import ErrorBanner from "../../../../../../shared-module/common/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/common/components/Spinner"
import { baseTheme, headingFont } from "../../../../../../shared-module/common/styles"
import { respondToOrLarger } from "../../../../../../shared-module/common/styles/respond"
import { PermissionPage } from "../../../../../PermissionPage"

const CoursePermissions: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const course = useQuery({
    queryKey: [`course-${courseId}-permissions`],
    queryFn: () => getCourse(courseId),
  })

  return (
    <div>
      {course.isPending && (
        <div
          className={css`
            margin-top: 40px;
            ${respondToOrLarger.sm} {
              margin-top: 80px;
            }
          `}
        >
          <Spinner variant="medium" />
        </div>
      )}
      {course.isError && (
        <div
          className={css`
            margin-top: 40px;
            ${respondToOrLarger.sm} {
              margin-top: 80px;
            }
          `}
        >
          <ErrorBanner error={course.error} />
        </div>
      )}
      {course.isSuccess && (
        <>
          <h1
            className={css`
              font-size: clamp(2rem, 3.6vh, 36px);
              color: ${baseTheme.colors.gray[700]};
              font-family: ${headingFont};
              font-weight: bold;
            `}
          >
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
