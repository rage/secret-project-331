import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import { PermissionPage } from "../../../../components/PermissionPage"
import { fetchExam } from "../../../../services/backend/exams"
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

const ExamPermissions: React.FC<React.PropsWithChildren<Props>> = ({ query }) => {
  const { t } = useTranslation()
  const exam = useQuery([`exam-${query.id}`], () => fetchExam(query.id))

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
        {exam.isLoading && <Spinner variant="large" />}
        {exam.isError && <ErrorBanner variant="readOnly" error={exam.error} />}
        {exam.isSuccess && (
          <>
            <h1>
              {t("roles-for-exam")} {exam.data.name}
            </h1>
            <PermissionPage
              domain={{
                // eslint-disable-next-line i18next/no-literal-string
                tag: "Exam",
                id: exam.data.id,
              }}
            />
          </>
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(ExamPermissions)))
