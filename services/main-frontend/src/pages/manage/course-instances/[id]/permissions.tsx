import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import { PermissionPage } from "../../../../components/PermissionPage"
import { fetchCourseInstance } from "../../../../services/backend/course-instances"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const CourseInstancePermissions: React.FC<Props> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstance = useQuery([`course-instance-${query.id}`], () =>
    fetchCourseInstance(query.id))

  return (
    <Layout navVariant="simple">
      <div
        className={css`
          margin-top: 40px;
          ${respondToOrLarger.sm} {
            margin-top: 80px;
          }
        `}
      >
        {courseInstance.isLoading && <Spinner variant="large" />}
        {courseInstance.isError && <ErrorBanner variant="readOnly" error={courseInstance.error} />}
        {courseInstance.isSuccess && (
          <>
            <h1>
              {t("roles-for-course-instance")} {courseInstance.data.name}
            </h1>
            <PermissionPage
              domain={{
                // eslint-disable-next-line i18next/no-literal-string
                tag: "CourseInstance",
                id: courseInstance.data.id,
              }}
            />
          </>
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstancePermissions)),
)
