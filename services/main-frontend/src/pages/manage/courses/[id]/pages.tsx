import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import { groupBy, max } from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import ChapterImageWidget from "../../../../components/page-specific/manage/courses/id/pages/ChapterImageWidget"
import ManageCourseStructure from "../../../../components/page-specific/manage/courses/id/pages/ManageCourseStructure"
import NewChapterForm from "../../../../components/page-specific/manage/courses/id/pages/NewChapterForm"
import PageList from "../../../../components/page-specific/manage/courses/id/pages/PageList"
import { fetchCourseStructure } from "../../../../services/backend/courses"
import Button from "../../../../shared-module/components/Button"
import DebugModal from "../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { frontendNormalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface CoursePagesProps {
  query: SimplifiedUrlQuery<"id">
}

const CoursePages: React.FC<CoursePagesProps> = ({ query }) => {
  const { id } = query
  const getCourseStructure = useQuery(`course-structure-${id}`, () => fetchCourseStructure(id))

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${frontendNormalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        {getCourseStructure.isError && <ErrorBanner variant={"link"} error={undefined} />}
        {getCourseStructure.isLoading && <Spinner variant={"medium"} />}
        {getCourseStructure.isSuccess && (
          <ManageCourseStructure
            courseStructure={getCourseStructure.data}
            refetch={getCourseStructure.refetch}
          />
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(CoursePages)))
