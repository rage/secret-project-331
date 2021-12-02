import { css } from "@emotion/css"
import React from "react"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import ManageCourse from "../../../../components/page-specific/manage/courses/id/index/ManageCourse"
import { getCourse } from "../../../../services/backend/courses"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { frontendWideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface ManageCoursePageProps {
  query: SimplifiedUrlQuery<"id">
}

const ManageCoursePage: React.FC<ManageCoursePageProps> = ({ query }) => {
  const getCourseQuery = useQuery(`course-${query.id}`, () => getCourse(query.id))

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${frontendWideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        {getCourseQuery.isError && (
          <ErrorBanner error={getCourseQuery.error} variant={"readOnly"} />
        )}
        {getCourseQuery.isLoading && <Spinner variant={"medium"} />}
        {getCourseQuery.isSuccess && (
          <ManageCourse course={getCourseQuery.data} refetch={getCourseQuery.refetch} />
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCoursePage)),
)
