import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { getCourse, postNewCourseTranslation } from "../../../../../../services/backend/courses"
import { NewCourse } from "../../../../../../shared-module/common/bindings"
import Button from "../../../../../../shared-module/common/components/Button"
import ErrorBanner from "../../../../../../shared-module/common/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/common/components/Spinner"
import { queryClient } from "../../../../../../shared-module/common/services/appQueryClient"
import { baseTheme, headingFont } from "../../../../../../shared-module/common/styles"

import CourseLanguageVersionsList, {
  formatLanguageVersionsQueryKey,
} from "./CourseLanguageVersionsList"
import NewCourseLanguageVersionDialog from "./NewCourseLanguageVersionDialog"

const CourseLanguageVersionsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)
  const getCourseQuery = useQuery({
    queryKey: [`course-${courseId}`],
    queryFn: () => getCourse(courseId),
  })

  const handleCreateNewLanguageVersion = async (newCourse: NewCourse) => {
    await postNewCourseTranslation(courseId, newCourse)
    await getCourseQuery.refetch()
    setShowNewLanguageVersionForm(false)
    queryClient.invalidateQueries({ queryKey: [formatLanguageVersionsQueryKey(courseId)] })
  }
  return (
    <>
      {getCourseQuery.isError && <ErrorBanner error={getCourseQuery.error} />}
      {getCourseQuery.isPending && <Spinner variant={"medium"} />}
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
