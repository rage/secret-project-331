import { css } from "@emotion/css"
import React from "react"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import ManageCourseStructure from "../../../../components/page-specific/manage/courses/id/pages/ManageCourseStructure"
import { fetchCourseStructure } from "../../../../services/backend/courses"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
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
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        {getCourseStructure.isError && (
          <ErrorBanner variant={"link"} error={getCourseStructure.error} />
        )}
        {(getCourseStructure.isLoading || getCourseStructure.isIdle) && (
          <Spinner variant={"medium"} />
        )}
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
