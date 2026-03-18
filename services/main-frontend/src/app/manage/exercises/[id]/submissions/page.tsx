"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseSubmissionList from "./ExerciseSubmissionList"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  downloadExerciseAnswersCsv,
  downloadExerciseDefinitionsCsv,
  ExerciseCsvExportTaskOption,
  fetchExerciseCsvExportTaskOptions,
  fetchExerciseSubmissions,
  getExercise,
} from "@/services/backend/exercises"
import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type ExportMode = "definitions" | "answers"

const downloadBlobAsFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", fileName)
  try {
    document.body.appendChild(link)
    link.click()
    link.parentNode?.removeChild(link)
  } finally {
    window.URL.revokeObjectURL(url)
  }
}

const SubmissionsPage: React.FC = () => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()
  const { id } = useParams<{ id: string }>()
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState("")
  const [exportMode, setExportMode] = useState<ExportMode | null>(null)

  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("header-submissions") }], [t])

  useRegisterBreadcrumbs({
    key: `exercise:${id}:submissions`,
    order: 60,
    crumbs,
  })

  const exerciseQuery = useQuery({
    queryKey: [`exercise`, id],
    queryFn: () => getExercise(id),
  })

  const exerciseSubmissionsQuery = useQuery({
    queryKey: [`exercise-submissions`, id, paginationInfo.page, paginationInfo.limit],
    queryFn: () => fetchExerciseSubmissions(id, paginationInfo.page, paginationInfo.limit),
  })

  const csvExportTaskOptionsQuery = useQuery({
    queryKey: [`exercise-csv-export-task-options`, id],
    queryFn: () => fetchExerciseCsvExportTaskOptions(id),
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
  }

  const exportCsvMutation = useToastMutation(
    async ({ mode, taskId }: { mode: ExportMode; taskId: string }) => {
      return mode === "definitions"
        ? await downloadExerciseDefinitionsCsv(id, taskId)
        : await downloadExerciseAnswersCsv(id, taskId)
    },
    { notify: true, method: "POST" },
    {
      onSuccess: (download) => {
        downloadBlobAsFile(download.blob, download.fileName)
        closeExportDialog()
      },
    },
  )

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

  const exportCsv = () => {
    if (!exportMode || !selectedTaskId) {
      return
    }
    exportCsvMutation.mutate({ mode: exportMode, taskId: selectedTaskId })
  }

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
            definitionTaskOptions.length === 0 ||
            exportCsvMutation.isPending
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
            answerTaskOptions.length === 0 ||
            exportCsvMutation.isPending
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
      {(exerciseQuery.isError || exerciseSubmissionsQuery.isError) && (
        <ErrorBanner
          variant={"readOnly"}
          error={exerciseQuery.error || exerciseSubmissionsQuery.error}
        />
      )}
      {csvExportTaskOptionsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={csvExportTaskOptionsQuery.error} />
      )}
      {(exerciseQuery.isLoading || exerciseSubmissionsQuery.isLoading) && (
        <Spinner variant={"medium"} />
      )}
      {exerciseQuery.isSuccess &&
        exerciseSubmissionsQuery.isSuccess &&
        exerciseQuery.data.course_id && (
          <>
            <ExerciseSubmissionList
              exerciseSubmissions={exerciseSubmissionsQuery.data.data}
              courseId={exerciseQuery.data.course_id}
            />
            <Pagination
              totalPages={exerciseSubmissionsQuery.data.total_pages}
              paginationInfo={paginationInfo}
            />
          </>
        )}
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
        <div
          className={css`
            display: flex;
            gap: 0.5rem;
            justify-content: flex-end;
          `}
        >
          <Button
            variant="white"
            size="small"
            onClick={closeExportDialog}
            disabled={exportCsvMutation.isPending}
          >
            {t("button-text-cancel")}
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={exportCsv}
            disabled={!selectedTaskId || exportCsvMutation.isPending}
          >
            {t("actions-export")}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(SubmissionsPage))
