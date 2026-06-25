"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseSubmissionList from "./ExerciseSubmissionList"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  getExerciseCsvExportTaskOptionsOptions,
  getExerciseOptions,
  getExerciseSubmissionsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseCsvExportTaskOption } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import Pagination from "@/shared-module/common/components/Pagination"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

type ExportMode = "definitions" | "answers"

const SubmissionsPage: React.FC = () => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()
  const { id } = useParams<{ id: string }>()
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState("")
  const [exportMode, setExportMode] = useState<ExportMode | null>(null)
  const [onlyLatestPerUser, setOnlyLatestPerUser] = useState(false)

  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("header-submissions") }], [t])

  useRegisterBreadcrumbs({
    key: `exercise:${id}:submissions`,
    order: 60,
    crumbs,
  })

  const exerciseQuery = useQuery({
    ...getExerciseOptions({
      path: {
        exercise_id: id,
      },
    }),
  })

  const exerciseSubmissionsQuery = useQuery({
    ...getExerciseSubmissionsOptions({
      path: {
        exercise_id: id,
      },
      query: {
        page: paginationInfo.page,
        limit: paginationInfo.limit,
      },
    }),
  })

  const csvExportTaskOptionsQuery = useQuery({
    ...getExerciseCsvExportTaskOptionsOptions({
      path: {
        exercise_id: id,
      },
    }),
  })

  const definitionTaskOptions = useMemo(
    () =>
      (csvExportTaskOptionsQuery.data ?? []).filter((task) => task.supports_csv_export_definitions),
    [csvExportTaskOptionsQuery.data],
  )

  const answerTaskOptions = useMemo(
    () => (csvExportTaskOptionsQuery.data ?? []).filter((task) => task.supports_csv_export_answers),
    [csvExportTaskOptionsQuery.data],
  )

  const getTaskLabel = (task: ExerciseCsvExportTaskOption) =>
    t("label-csv-export-task-option", {
      order: task.order_number + 1,
      exerciseType: task.exercise_type,
    })

  const closeExportDialog = () => {
    setIsExportDialogOpen(false)
    setExportMode(null)
    setOnlyLatestPerUser(false)
  }

  const openExportDialog = (mode: ExportMode) => {
    const options = mode === "definitions" ? definitionTaskOptions : answerTaskOptions
    if (options.length === 0) {
      return
    }
    setExportMode(mode)
    setSelectedTaskId(options[0].exercise_task_id)
    setIsExportDialogOpen(true)
  }

  const currentTaskOptions =
    exportMode === "definitions" ? definitionTaskOptions : answerTaskOptions

  const exportHref =
    exportMode === "definitions"
      ? // eslint-disable-next-line i18next/no-literal-string
        `/api/v0/main-frontend/exercises/${id}/export-definitions-csv?exercise_task_id=${encodeURIComponent(selectedTaskId)}`
      : // eslint-disable-next-line i18next/no-literal-string
        `/api/v0/main-frontend/exercises/${id}/export-answers-csv?exercise_task_id=${encodeURIComponent(selectedTaskId)}${onlyLatestPerUser ? "&only_latest_per_user=true" : ""}`

  return (
    <div>
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        `}
      >
        <h3
          className={css`
            font-weight: ${fontWeights.medium};
            margin: 0;
          `}
        >
          {t("header-submissions")}
        </h3>
        {exerciseSubmissionsQuery.isSuccess && (
          <DebugModal
            variant="minimal"
            data={exerciseSubmissionsQuery.data}
            buttonWrapperStyles={css`
              display: flex;
              align-items: center;
            `}
          />
        )}
      </div>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        `}
      >
        <Button
          variant="secondary"
          size="small"
          // eslint-disable-next-line i18next/no-literal-string
          onClick={() => openExportDialog("definitions")}
          disabled={
            csvExportTaskOptionsQuery.isLoading ||
            csvExportTaskOptionsQuery.isError ||
            definitionTaskOptions.length === 0
          }
        >
          {t("button-text-export-definitions-csv")}
        </Button>
        <Button
          variant="secondary"
          size="small"
          // eslint-disable-next-line i18next/no-literal-string
          onClick={() => openExportDialog("answers")}
          disabled={
            csvExportTaskOptionsQuery.isLoading ||
            csvExportTaskOptionsQuery.isError ||
            answerTaskOptions.length === 0
          }
        >
          {t("button-text-export-answers-csv")}
        </Button>
      </div>
      {csvExportTaskOptionsQuery.isSuccess &&
        definitionTaskOptions.length === 0 &&
        answerTaskOptions.length === 0 && (
          <p
            className={css`
              margin-top: 0;
              margin-bottom: 1rem;
            `}
          >
            {t("message-csv-export-not-supported-for-this-exercise-type")}
          </p>
        )}
      {csvExportTaskOptionsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={csvExportTaskOptionsQuery.error} />
      )}
      <QueryResults
        queries={[exerciseQuery, exerciseSubmissionsQuery] as const}
        renderData={([exercise, exerciseSubmissions]) =>
          exercise.course_id ? (
            <>
              <ExerciseSubmissionList
                exerciseSubmissions={exerciseSubmissions.data}
                courseId={exercise.course_id}
              />
              <Pagination
                totalPages={exerciseSubmissions.total_pages}
                paginationInfo={paginationInfo}
              />
            </>
          ) : null
        }
      />
      <Dialog open={isExportDialogOpen} onClose={closeExportDialog}>
        <h1>
          {exportMode === "definitions"
            ? t("title-export-definitions-csv")
            : t("title-export-answers-csv")}
        </h1>
        <SelectField
          id="csv-export-task-select"
          label={t("label-csv-export-task")}
          value={selectedTaskId}
          onChangeByValue={(value) => setSelectedTaskId(value)}
          options={currentTaskOptions.map((task) => ({
            label: getTaskLabel(task),
            value: task.exercise_task_id,
          }))}
        />
        {exportMode === "answers" && (
          <CheckBox
            label={t("label-csv-export-only-latest-per-user")}
            checked={onlyLatestPerUser}
            onChangeByValue={(checked) => setOnlyLatestPerUser(checked)}
          />
        )}
        <div
          className={css`
            display: flex;
            gap: 0.5rem;
            justify-content: flex-end;
          `}
        >
          <Button variant="white" size="small" onClick={closeExportDialog}>
            {t("button-text-cancel")}
          </Button>
          <a
            href={exportHref}
            onClick={closeExportDialog}
            aria-label={t("actions-export")}
            download
          >
            <Button variant="primary" size="small" disabled={!selectedTaskId} type="button">
              {t("actions-export")}
            </Button>
          </a>
        </div>
      </Dialog>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(SubmissionsPage))
