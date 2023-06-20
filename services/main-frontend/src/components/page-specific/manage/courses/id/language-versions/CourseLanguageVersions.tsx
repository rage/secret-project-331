import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { getCourse, postNewCourseTranslation } from "../../../../../../services/backend/courses"
import { NewCourse } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { queryClient } from "../../../../../../shared-module/services/appQueryClient"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"

import CourseLanguageVersionsList, {
  formatLanguageVersionsQueryKey,
} from "./CourseLanguageVersionsList"
import NewCourseLanguageVersionDialog from "./NewCourseLanguageVersionDialog"

const CourseLanguageVersionsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)
  const getCourseQuery = useQuery([`course-${courseId}`], () => getCourse(courseId))

  const handleCreateNewLanguageVersion = async (newCourse: NewCourse) => {
    await postNewCourseTranslation(courseId, newCourse)
    await getCourseQuery.refetch()
    setShowNewLanguageVersionForm(false)
    queryClient.invalidateQueries([formatLanguageVersionsQueryKey(courseId)])
  }
  return (
    <>
      {getCourseQuery.isError && <ErrorBanner error={getCourseQuery.error} variant={"readOnly"} />}
      {getCourseQuery.isLoading && <Spinner variant={"medium"} />}
      {getCourseQuery.isSuccess && (
        <>
          {showNewLanguageVersionForm && (
            <NewCourseLanguageVersionDialog
              showNewLanguageVersionForm={showNewLanguageVersionForm}
              courseName={getCourseQuery.data.name}
              organizationId={getCourseQuery.data.organization_id}
              handleSubmit={handleCreateNewLanguageVersion}
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
    </>
  )
}

export default CourseLanguageVersionsPage
