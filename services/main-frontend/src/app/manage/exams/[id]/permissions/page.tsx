"use client"
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { PermissionPage } from "@/components/PermissionPage"
import { fetchExam } from "@/services/backend/exams"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ExamPermissions: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const exam = useQuery({ queryKey: [`exam-${id}`], queryFn: () => fetchExam(id) })

  return (
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
  )
}

export default withErrorBoundary(withSignedIn(ExamPermissions))
