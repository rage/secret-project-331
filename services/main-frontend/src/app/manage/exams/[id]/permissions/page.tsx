"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { PermissionPage } from "@/components/PermissionPage"
import { getExamOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const ExamPermissions: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const exam = useQuery({
    ...getExamOptions({
      path: {
        id,
      },
    }),
  })

  usePageTitle(joinTitleSegments([t("link-permissions"), exam.data?.name]), { order: 10 })

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      <QueryResult query={exam}>
        {(data) => (
          <>
            <h1>
              {t("roles-for-exam")} {data.name}
            </h1>
            <PermissionPage
              domain={{
                // eslint-disable-next-line i18next/no-literal-string
                tag: "Exam",
                id: data.id,
              }}
            />
          </>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(ExamPermissions))
