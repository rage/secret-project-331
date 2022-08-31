// Disabled for development
/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import ChapterPointsDashboard from "../../../../components/page-specific/manage/course-instances/id/ChapterPointsDashboard"
import FullWidthTable, { FullWidthTableRow } from "../../../../components/tables/FullWidthTable"
import { getCompletions } from "../../../../services/backend/course-instances"
import { UserWithModuleCompletions } from "../../../../shared-module/bindings"
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

interface Sorting {
  type: string
  data: string | null
}

const CompletionsPage: React.FC<CompletionsPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstanceId = query.id
  const getCompletionsList = useQuery([`completions-list-${courseInstanceId}`], () =>
    getCompletions(courseInstanceId),
  )
  const [sorting, setSorting] = useState<Sorting>({ type: NAME, data: null })

  function sortUsers(first: UserWithModuleCompletions, second: UserWithModuleCompletions): number {
    if (sorting.type === NUMBER) {
      return first.user_id.localeCompare(second.user_id)
    } else if (sorting.type === NAME) {
      return `${first.last_name} ${first.first_name}`.localeCompare(
        `${second.last_name} ${second.first_name}`,
      )
    } else if (sorting.type === EMAIL) {
      return first.email.localeCompare(second.email)
    } else {
      return (
        (second.completed_modules.includes(sorting.data ?? "") ? 1 : 0) -
        (first.completed_modules.includes(sorting.data ?? "") ? 1 : 0)
      )
    }
  }

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
              chapterScores={getCompletionsList.data.course_modules.map((x) => ({
                id: x.id,
                name: x.name ?? t("label-default"),
                value: `${
                  getCompletionsList.data.users_with_course_module_completions.filter((user) =>
                    user.completed_modules.includes(x.id),
                  ).length
                }/${getCompletionsList.data.users_with_course_module_completions.length}`,
              }))}
              title="Total completion dashboard"
              userCount={getCompletionsList.data.users_with_course_module_completions.length}
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
                  <a href="#number" onClick={() => setSorting({ type: NUMBER, data: null })}>
                    {DOWN_ARROW}
                  </a>
                </th>
                <th>
                  {t("student-name")}{" "}
                  <a href="#name" onClick={() => setSorting({ type: NAME, data: null })}>
                    {DOWN_ARROW}
                  </a>
                </th>

                <th>
                  {t("label-email")}{" "}
                  <a href="#email" onClick={() => setSorting({ type: EMAIL, data: null })}>
                    {DOWN_ARROW}
                  </a>
                </th>
                {getCompletionsList.data.course_modules
                  .sort((a, b) => a.order_number - b.order_number)
                  .map((module) => {
                    const moduleSorting = `#mod${module.order_number}`
                    return (
                      <th key={module.id}>
                        {module.name ?? t("label-default")}{" "}
                        <a
                          href={moduleSorting}
                          onClick={() => setSorting({ type: moduleSorting, data: module.id })}
                        >
                          {DOWN_ARROW}
                        </a>
                      </th>
                    )
                  })}
              </tr>
            </thead>
            <tbody>
              {getCompletionsList.data.users_with_course_module_completions
                .sort(sortUsers)
                .map((user) => (
                  <FullWidthTableRow key={user.user_id}>
                    <td>{user.user_id}</td>
                    <td>
                      {user.first_name} {user.last_name}
                    </td>
                    <td>{user.email}</td>
                    {getCompletionsList.data.course_modules
                      .sort((a, b) => a.order_number - b.order_number)
                      .map((module) => (
                        <td key={module.id}>
                          {user.completed_modules.includes(module.id) ? "yes" : "no"}
                        </td>
                      ))}
                  </FullWidthTableRow>
                ))}
            </tbody>
          </FullWidthTable>
        </>
      )}
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(CompletionsPage)))
