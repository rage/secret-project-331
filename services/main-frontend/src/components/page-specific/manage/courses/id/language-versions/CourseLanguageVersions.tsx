import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import CourseLanguageVersionsList from "./CourseLanguageVersionsList"
import NewCourseLanguageVersionDialog from "./NewCourseLanguageVersionDialog"

import { formatLanguageVersionsQueryKey } from "@/hooks/useCourseLanguageVersions"
import useCourseQuery from "@/hooks/useCourseQuery"
import { useCreateCourseCopy } from "@/hooks/useCreateCourseCopy"
import { NewCourse } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const CourseLanguageVersionsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)
  const getCourseQuery = useCourseQuery(courseId)
  const createCourseCopyMutation = useCreateCourseCopy()

  const handleCreateNewLanguageVersion = async (newCourse: NewCourse) => {
    await createCourseCopyMutation.mutateAsync({
      courseId,
      data: {
        ...newCourse,
        // eslint-disable-next-line i18next/no-literal-string
        mode: { mode: "same_language_group" },
      },
    })
    await getCourseQuery.refetch()
    setShowNewLanguageVersionForm(false)
    queryClient.invalidateQueries({ queryKey: [formatLanguageVersionsQueryKey(courseId)] })
  }
  return (
    <>
      {getCourseQuery.isError && <ErrorBanner error={getCourseQuery.error} variant={"readOnly"} />}
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
