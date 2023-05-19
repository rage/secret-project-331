import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../components/Layout"
import CourseInstanceEnrollmentsList from "../../../components/page-specific/manage/user/id/CourseInstanceEnrollmentsList"
import { getUserDetails } from "../../../services/backend/user-details"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface UserPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Area = styled.div`
  margin: 2rem 0;
`

const UserPage: React.FC<React.PropsWithChildren<UserPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const userDetailsQuery = useQuery(["user-details", query.id], () => getUserDetails(query.id))

  if (userDetailsQuery.isError) {
    return (
      <Layout>
        <ErrorBanner error={userDetailsQuery.error} variant="readOnly" />
      </Layout>
    )
  }
  if (userDetailsQuery.isLoading) {
    return (
      <Layout>
        <Spinner variant="medium" />
      </Layout>
    )
  }

  return (
    <Layout>
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
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(UserPage)))
