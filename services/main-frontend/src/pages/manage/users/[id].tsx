import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseInstanceEnrollmentsList from "../../../components/page-specific/manage/user/id/CourseInstanceEnrollmentsList"
import { getUserDetails } from "../../../services/backend/user-details"

import ExerciseResetLogList from "@/components/page-specific/manage/user/id/ExerciseResetLogList"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface UserPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Area = styled.div`
  margin: 2rem 0;
`

const UserPage: React.FC<React.PropsWithChildren<UserPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const userDetailsQuery = useQuery({
    queryKey: ["user-details", query.id],
    queryFn: () => getUserDetails(query.id),
  })

  if (userDetailsQuery.isError) {
    return <ErrorBanner error={userDetailsQuery.error} variant="readOnly" />
  }
  if (userDetailsQuery.isPending) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <Area>
        <h1>{t("header-user-details")}</h1>
        <p>
          {t("label-user-id")}: {query.id}
        </p>
        <p>
          {t("label-email")}: {userDetailsQuery.data.email}
        </p>
        <p>
          {t("first-name")}: {userDetailsQuery.data.first_name}
        </p>
        <p>
          {t("last-name")}: {userDetailsQuery.data.last_name}
        </p>
      </Area>
      <Area>
        <h2>{t("header-course-instance-enrollments")}</h2>
        <CourseInstanceEnrollmentsList userId={query.id} />
      </Area>
      <OnlyRenderIfPermissions action={{ type: "teach" }} resource={{ type: "global_permissions" }}>
        <Area>
          <p
            className={css`
              font-size: ${baseTheme.fontSizes[3]}px;
              font-weight: ${fontWeights.medium};
            `}
          >
            {t("label-exercise-reset-log")}
          </p>
          <ExerciseResetLogList userId={query.id} />
        </Area>
      </OnlyRenderIfPermissions>
    </>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(UserPage)))
