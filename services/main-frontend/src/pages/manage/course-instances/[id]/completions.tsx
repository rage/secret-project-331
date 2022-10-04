import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { maxBy } from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import AddCompletionsForm from "../../../../components/forms/AddCompletionsForm"
import ChapterPointsDashboard from "../../../../components/page-specific/manage/course-instances/id/ChapterPointsDashboard"
import CompletionRegistrationPreview from "../../../../components/page-specific/manage/course-instances/id/CompletionRegistrationPreview"
import UserCompletionRow, {
  UserCompletionRowUser,
} from "../../../../components/page-specific/manage/course-instances/id/UserCompletionRow"
import FullWidthTable from "../../../../components/tables/FullWidthTable"
import {
  getCompletions,
  postCompletions,
  postCompletionsPreview,
} from "../../../../services/backend/course-instances"
import {
  CourseModuleCompletionWithRegistrationInfo,
  ManualCompletionPreview,
  TeacherManualCompletionRequest,
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
  const getCompletionsList = useQuery([`completions-list-${courseInstanceId}`], async () => {
    const completions = await getCompletions(courseInstanceId)
    const sortedCourseModules = completions.course_modules.sort(
      (a, b) => a.order_number - b.order_number,
    )
    return {
      sortedCourseModules,
      users: completions.users_with_course_module_completions.map(prepareUser),
    }
  })
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

  function sortUsers(first: UserCompletionRowUser, second: UserCompletionRowUser): number {
    if (sorting.type === NUMBER) {
      return first.userId.localeCompare(second.userId)
    } else if (sorting.type === NAME) {
      return `${first.lastName} ${first.firstName}`.localeCompare(
        `${second.lastName} ${second.firstName}`,
      )
    } else if (sorting.type === EMAIL) {
      return first.email.localeCompare(second.email)
    } else {
      return (
        (maxBy(second.moduleCompletions.get(sorting.data ?? "") ?? [], "grade")?.grade ?? 0) -
        (maxBy(first.moduleCompletions.get(sorting.data ?? "") ?? [], "grade")?.grade ?? 0)
      )
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
              chapterScores={getCompletionsList.data.sortedCourseModules.map((module) => ({
                id: module.id,
                name: module.name ?? t("label-default"),
                value: `${
                  getCompletionsList.data.users.filter(
                    (user) => (user.moduleCompletions.get(module.id) ?? []).length > 0,
                  ).length
                }/${getCompletionsList.data.users.length}`,
              }))}
              title={t("total-completions-dashboard")}
              userCount={getCompletionsList.data.users.length}
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
                    courseModules={getCompletionsList.data.sortedCourseModules}
                    submitText={t("button-text-check")}
                  />
                  {previewData && completionFormData && (
                    <CompletionRegistrationPreview
                      manualCompletionPreview={previewData}
                      onSubmit={(options) => {
                        mutation.mutate({
                          ...completionFormData,
                          skip_duplicate_completions: options.skipDuplicateCompletions,
                        })
                      }}
                    />
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
                <th rowSpan={2}>
                  {t("label-user-id")}{" "}
                  <a href="#number" onClick={() => setSorting({ type: NUMBER, data: null })}>
                    {DOWN_ARROW}
                  </a>
                </th>
                <th rowSpan={2}>
                  {t("student-name")}{" "}
                  <a href="#name" onClick={() => setSorting({ type: NAME, data: null })}>
                    {DOWN_ARROW}
                  </a>
                </th>
                <th rowSpan={2}>
                  {t("label-email")}{" "}
                  <a href="#email" onClick={() => setSorting({ type: EMAIL, data: null })}>
                    {DOWN_ARROW}
                  </a>
                </th>
                {getCompletionsList.data.sortedCourseModules
                  .sort((a, b) => a.order_number - b.order_number)
                  .map((module) => {
                    // eslint-disable-next-line i18next/no-literal-string
                    const moduleSorting = `#mod${module.order_number}`
                    return (
                      <th key={module.id} colSpan={2}>
                        <div
                          className={css`
                            text-align: center;
                          `}
                        >
                          {module.name ?? t("label-default")}{" "}
                          <a
                            href={moduleSorting}
                            onClick={() => setSorting({ type: moduleSorting, data: module.id })}
                          >
                            {DOWN_ARROW}
                          </a>
                        </div>
                      </th>
                    )
                  })}
              </tr>
              <tr>
                {getCompletionsList.data.sortedCourseModules.map((_, i) => (
                  <React.Fragment key={i}>
                    <td>{t("label-grade")}</td>
                    <td>{t("label-registered")}</td>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {getCompletionsList.data.users.sort(sortUsers).map((user) => (
                <UserCompletionRow
                  key={user.userId}
                  sortedCourseModules={getCompletionsList.data.sortedCourseModules}
                  user={user}
                />
              ))}
            </tbody>
          </FullWidthTable>
          <p>*: {t("module-is-completed-but-requires-completion-of-prerequisite-modules")}</p>
        </>
      )}
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(CompletionsPage)))

function prepareUser(user: UserWithModuleCompletions): UserCompletionRowUser {
  const moduleCompletions = new Map<string, Array<CourseModuleCompletionWithRegistrationInfo>>()
  for (const completion of user.completed_modules) {
    const bucket = moduleCompletions.get(completion.course_module_id) ?? []
    bucket.push(completion)
    moduleCompletions.set(completion.course_module_id, bucket)
  }
  for (const completions of Array.from(moduleCompletions.values())) {
    completions.sort((a, b) => (a.created_at >= b.created_at ? 1 : -1))
  }
  return {
    moduleCompletions,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    userId: user.user_id,
  }
}
