import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { PermissionPage } from "../../../../components/PermissionPage"
import { fetchCourseInstance } from "../../../../services/backend/course-instances"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const CourseInstancePermissions: React.FC<React.PropsWithChildren<Props>> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstance = useQuery({
    queryKey: [`course-instance-${query.id}`],
    queryFn: () => fetchCourseInstance(query.id),
  })

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      {courseInstance.isPending && <Spinner variant="large" />}
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
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstancePermissions)),
)
