// Disabled for development
/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import ChapterPointsDashboard from "../../../../components/page-specific/manage/course-instances/id/ChapterPointsDashboard"
import FullWidthTable, { FullWidthTableRow } from "../../../../components/tables/FullWidthTable"
import { ChapterScore } from "../../../../shared-module/bindings"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

const DOWN_ARROW = "v"
const EMAIL = "email"
const NAME = "name"
const NUMBER = "number"

export interface CompletionsPageProps {
  query: SimplifiedUrlQuery<"id">
}

const CompletionsPage: React.FC<CompletionsPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstanceId = query.id
  const getCompletionsList = useQuery(
    [`completions-list-${courseInstanceId}`],
    async (): Promise<Array<ChapterScore>> => [],
  )
  const [sorting, setSorting] = useState(NAME)

  return (
    <Layout navVariant="simple">
      <h2>Completions</h2>
      {getCompletionsList.isError && (
        <ErrorBanner variant="readOnly" error={getCompletionsList.error} />
      )}
      {getCompletionsList.isLoading && <Spinner variant="medium" />}
      {getCompletionsList.isSuccess && (
        <>
          <div>
            <ChapterPointsDashboard
              chapterScores={getCompletionsList.data}
              title="Total completion dashboard"
              userCount={getCompletionsList.data.length}
            />
          </div>
          <FullWidthTable>
            <thead>
              <tr
                className={css`
                  text-align: left;
                  font-size: 13px;
                `}
              >
                <th>
                  {t("serial-number")}{" "}
                  <a href="#number" onClick={() => setSorting(NUMBER)}>
                    {DOWN_ARROW}
                  </a>
                </th>
                <th>
                  {t("student-name")}{" "}
                  <a href="#name" onClick={() => setSorting(NAME)}>
                    {DOWN_ARROW}
                  </a>
                </th>

                <th>
                  {t("label-email")}{" "}
                  <a href="#email" onClick={() => setSorting(EMAIL)}>
                    {DOWN_ARROW}
                  </a>
                </th>
                <th>
                  Module 1{" "}
                  <a href="#mod0" onClick={() => setSorting("mod10")}>
                    {DOWN_ARROW}
                  </a>
                </th>
              </tr>
            </thead>
            <tbody>
              <FullWidthTableRow>
                <td>123456</td>
                <td>John Doe</td>
                <td>john.doe@example.com</td>
                <td>yes</td>
              </FullWidthTableRow>
              {/* {getCompletionsList.data.map(x => )} */}
            </tbody>
          </FullWidthTable>
        </>
      )}
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(CompletionsPage)))
