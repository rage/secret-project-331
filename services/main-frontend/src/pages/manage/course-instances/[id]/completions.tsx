import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import AddCompletionsForm from "../../../../components/forms/AddCompletionsForm"
import ChapterPointsDashboard from "../../../../components/page-specific/manage/course-instances/id/ChapterPointsDashboard"
import FullWidthTable, { FullWidthTableRow } from "../../../../components/tables/FullWidthTable"
import {
  getCompletions,
  postCompletions,
  postCompletionsPreview,
} from "../../../../services/backend/course-instances"
import {
  ManualCompletionPreview,
  TeacherManualCompletionRequest,
  UserCourseModuleCompletion,
  UserWithModuleCompletions,
} from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
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
  const [showForm, setShowForm] = useState(false)
  const [sorting, setSorting] = useState<Sorting>({ type: NAME, data: null })
  const [completionFormData, setCompletionFormData] =
    useState<TeacherManualCompletionRequest | null>(null)
  const [previewData, setPreviewData] = useState<ManualCompletionPreview | null>(null)
  const mutation = useToastMutation(
    (data: TeacherManualCompletionRequest) => postCompletions(courseInstanceId, data),
    { notify: true, method: "POST", successMessage: t("completions-submitted-successfully") },
    {
      onSuccess: () => {
        setCompletionFormData(null)
        setPreviewData(null)
        setShowForm(false)
        getCompletionsList.refetch()
      },
    },
  )

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
        (second.completed_modules.find((x) => x.course_module_id === sorting.data)?.grade ?? 0) -
        (first.completed_modules.find((x) => x.course_module_id === sorting.data)?.grade ?? 0)
      )
    }
  }

  function mapGradeToText(moduleCompletion: UserCourseModuleCompletion | undefined): string {
    if (moduleCompletion) {
      if (moduleCompletion.grade !== null) {
        return moduleCompletion.grade.toString()
      } else {
        return moduleCompletion.passed ? t("column-passed") : t("column-failed")
      }
    } else {
      return "-"
    }
  }

  const handlePostCompletionsPreview = async (
    data: TeacherManualCompletionRequest,
  ): Promise<void> => {
    setCompletionFormData(data)
    const previewDataFromBackend = await postCompletionsPreview(courseInstanceId, data)
    setPreviewData(previewDataFromBackend)
  }

  return (
    <Layout navVariant="simple">
      <h2>
        {t("completions")}: {courseInstanceId}
      </h2>
      {getCompletionsList.isError && (
        <ErrorBanner variant="readOnly" error={getCompletionsList.error} />
      )}
      {getCompletionsList.isLoading && <Spinner variant="medium" />}
      {getCompletionsList.isSuccess && (
        <>
          <div>
            <ChapterPointsDashboard
              chapterScores={getCompletionsList.data.course_modules.map((module) => ({
                id: module.id,
                name: module.name ?? t("label-default"),
                value: `${
                  getCompletionsList.data.users_with_course_module_completions.filter((user) =>
                    user.completed_modules.some((x) => x.course_module_id === module.id),
                  ).length
                }/${getCompletionsList.data.users_with_course_module_completions.length}`,
              }))}
              title={t("total-completions-dashboard")}
              userCount={getCompletionsList.data.users_with_course_module_completions.length}
            />
          </div>
          <div
            className={css`
              margin: 2rem;
            `}
          >
            <Button variant="primary" size="small" onClick={() => setShowForm(!showForm)}>
              {t("manually-add-completions")}
            </Button>
            {showForm && (
              <div
                className={css`
                  margin: 2rem;
                `}
              >
                <div>
                  <AddCompletionsForm
                    onSubmit={handlePostCompletionsPreview}
                    courseModules={getCompletionsList.data.course_modules}
                    submitText={t("button-text-check")}
                  />
                  {previewData && completionFormData && (
                    <div>
                      {/* No localizations yet because text subject to change */}
                      {/* eslint-disable i18next/no-literal-string */}
                      <p>New user completions: {previewData.first_time_completing_users.length}</p>
                      <p>These users will receive completion for the first time.</p>
                      <p>Already completed users: {previewData.already_completed_users.length}</p>
                      <p>
                        These users already have a completion for the course, and proceeding will
                        create them new completions without changing the existing ones.
                      </p>
                      <p>Missing enrollments: {previewData.non_enrolled_users.length}</p>
                      <p>
                        These users haven&apost enrolled on the course instance, so proceeding will
                        automatically create them necessary entries.
                      </p>
                      {/* eslint-enable i18next/no-literal-string */}
                      <Button
                        variant="primary"
                        size="medium"
                        type="button"
                        value={t("button-text-submit")}
                        onClick={() => mutation.mutate(completionFormData)}
                      >
                        {t("button-text-submit")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                    // eslint-disable-next-line i18next/no-literal-string
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
                          {mapGradeToText(
                            user.completed_modules.find((x) => x.course_module_id === module.id),
                          )}
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
