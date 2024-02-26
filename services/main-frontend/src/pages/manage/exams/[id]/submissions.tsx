/* eslint-disable i18next/no-literal-string */
//MUISTA  POISTAA
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchExerciseSubmissionsWithExamId } from "../../../../services/backend/exams"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Pagination from "../../../../shared-module/components/Pagination"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import usePaginationInfo from "../../../../shared-module/hooks/usePaginationInfo"
import {
  baseTheme,
  fontWeights,
  headingFont,
  secondaryFont,
} from "../../../../shared-module/styles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const GradingPage: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getSubmissions = useQuery({
    queryKey: [
      `/exams/${query.id}/submissions`,
      query.id,
      paginationInfo.page,
      paginationInfo.limit,
    ],
    queryFn: () =>
      fetchExerciseSubmissionsWithExamId(query.id, paginationInfo.page, paginationInfo.limit),
  })

  console.log(getSubmissions.data)

  return (
    <div>
      <h3
        className={css`
          font-weight: ${fontWeights.medium};
        `}
      >
        {t("header-submissions")}
      </h3>
      {getSubmissions.isError && <ErrorBanner variant={"readOnly"} error={getSubmissions.error} />}
      {getSubmissions.isPending && <Spinner variant={"medium"} />}
      {getSubmissions.isSuccess && (
        <>
          <table
            className={css`
              border-collapse: collapse;
              border: 1px solid ${baseTheme.colors.clear[300]};
              margin-top: 1.5rem;
              width: 100%;

              td,
              th {
                max-width: 0;
                border-left: 1px solid ${baseTheme.colors.clear[300]};
                border-right: 1px solid ${baseTheme.colors.clear[300]};
                color: ${baseTheme.colors.gray[500]};
                padding-left: 30px;
                padding-right: 30px;
                text-align: left;
                height: 60px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
            `}
          >
            <thead>
              <tr
                className={css`
                  font-family: ${secondaryFont};
                  font-weight: ${fontWeights.semibold};
                  font-size: ${baseTheme.fontSizes[14]};
                  text-transform: uppercase;
                  opacity: 0.8;
                  padding-right: 30px;
                `}
              >
                <th>Student</th>
                <th>Status</th>
                <th>Action</th>
                <th>Date and time</th>
                <th>Feedbacks</th>
                <th>Flag</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody
              className={css`
                tr:nth-child(odd) {
                  background-color: ${baseTheme.colors.clear[100]};
                }
              `}
            >
              {getSubmissions.data.data.map((submission) => (
                <tr
                  key={submission.id}
                  className={css`
                    font-family: ${headingFont};
                    font-weight: ${fontWeights.medium};
                    font-size: ${baseTheme.fontSizes[16]};
                    line-height: 19px;
                  `}
                >
                  <td>{submission.user_id}</td>
                  <td>-</td>
                  <td
                    className={css`
                      font-size: 20px;
                      text-align: center !important;
                    `}
                  >
                    <Link
                      href={{
                        pathname: "/submissions/[id]/grading/",
                        query: { id: submission.id },
                      }}
                    >
                      {t("link")}
                    </Link>
                  </td>
                  <td>{submission.created_at.toLocaleString()}</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            totalPages={getSubmissions.data.total_pages}
            paginationInfo={paginationInfo}
          />
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(GradingPage)))
