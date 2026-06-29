"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CourseLanguageVersionsList from "./CourseLanguageVersionsList"
import NewCourseLanguageVersionDialog from "./NewCourseLanguageVersionDialog"

import { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import { getCourseLanguageVersionsQueryKey } from "@/hooks/useCourseLanguageVersions"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import Button from "@/shared-module/common/components/Button"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { QueryResult } from "@/shared-module/components"

const CourseLanguageVersionsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)
  const getCourseQuery = useCourseQuery(courseId)

  const handleSuccess = async () => {
    await getCourseQuery.refetch()
    setShowNewLanguageVersionForm(false)
    queryClient.invalidateQueries({ queryKey: getCourseLanguageVersionsQueryKey(courseId) })
  }

  return (
    <QueryResult query={getCourseQuery}>
      {(course) => (
        <>
          {showNewLanguageVersionForm && (
            <NewCourseLanguageVersionDialog
              showNewLanguageVersionForm={showNewLanguageVersionForm}
              courseName={course.name}
              organizationId={course.organization_id}
              onSuccess={handleSuccess}
              onClose={() => setShowNewLanguageVersionForm(false)}
              courseId={courseId}
            />
          )}
          <h2
            className={css`
              font-size: clamp(2rem, 3.6vh, 36px);
              color: ${baseTheme.colors.gray[700]};
              font-family: ${headingFont};
              font-weight: bold;
            `}
          >
            {t("title-all-course-language-versions")}
          </h2>
          <CourseLanguageVersionsList courseId={courseId} />
          <Button
            size="medium"
            variant="primary"
            onClick={() => setShowNewLanguageVersionForm(true)}
          >
            {t("button-text-new")}
          </Button>
        </>
      )}
    </QueryResult>
  )
}

export default CourseLanguageVersionsPage
