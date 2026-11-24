"use client"

import { useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  deleteExerciseRepositoryMutation as deleteExerciseRepositoryMutationOptions,
  getExerciseRepositoriesForCourseOptions,
  getExerciseRepositoriesForExamOptions,
  syncExerciseRepositoryMutation as syncExerciseRepositoryMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  ExerciseRepository,
  ExerciseRepositorySyncReport,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { dateToString } from "@/shared-module/common/utils/time"
import { Button, QueryResult } from "@/shared-module/components"

import AddExerciseRepositoryForm from "./AddExerciseRepositoryForm"
import EditExerciseRepositoryForm from "./EditExerciseRepositoryForm"

const PENDING_POLL_INTERVAL_MS = 3000

/** Polls while a sync is queued or running, so its outcome shows up without a reload. */
const refetchWhilePending = (query: { state: { data: ExerciseRepository[] | undefined } }) =>
  query.state.data?.some((repository) => repository.status === "Pending")
    ? PENDING_POLL_INTERVAL_MS
    : false

const SyncReport: React.FC<{ report: ExerciseRepositorySyncReport }> = ({ report }) => {
  const { t } = useTranslation()
  const rows: [string, string[]][] = [
    [t("exercise-repositories-sync-added"), report.added],
    [t("exercise-repositories-sync-updated"), report.updated],
    [
      t("exercise-repositories-sync-renamed"),
      // oxlint-disable-next-line i18next/no-literal-string
      report.renamed.map((renamed) => `${renamed.from} → ${renamed.to}`),
    ],
    [t("exercise-repositories-sync-removed"), report.removed],
    [t("exercise-repositories-sync-missing-but-in-use"), report.missing_but_in_use],
  ]
  return (
    <div>
      <ul>
        {rows.map(([label, names]) => (
          <li key={label}>
            {label}: {names.length}
            {names.length > 0 && ` (${names.join(", ")})`}
          </li>
        ))}
        <li>
          {t("exercise-repositories-sync-refreshed-tasks")}: {report.refreshed_exercise_task_count}
        </li>
      </ul>
      {report.failed_exercise_tasks.length > 0 && (
        <>
          {t("exercise-repositories-sync-failed-tasks")}
          <ul>
            {report.failed_exercise_tasks.map((failed) => (
              <li key={failed.exercise_task_id}>
                {failed.repository_exercise}: {failed.error}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

interface Props {
  courseId: string | null
  examId: string | null
}

interface ExerciseRepositoriesContentProps extends Props {
  exerciseRepositories: UseQueryResult<ExerciseRepository[], Error>
}

const ExerciseRepositoriesContent: React.FC<ExerciseRepositoriesContentProps> = ({
  courseId,
  examId,
  exerciseRepositories,
}) => {
  const { t } = useTranslation()

  const [addingRepo, setAddingRepo] = useState(false)
  const [editingRepo, setEditingRepo] = useState<string | null>(null)

  useEffect(() => {
    setAddingRepo(false)
  }, [exerciseRepositories.data])

  const deleteMutation = useToastMutationOptions(
    deleteExerciseRepositoryMutationOptions(),
    {
      notify: true,
      method: "DELETE",
      successMessage: t("exercise-repositories-deleted"),
    },
    {
      onSuccess: () => {
        setEditingRepo(null)
        exerciseRepositories.refetch()
      },
    },
  )

  const syncMutation = useToastMutationOptions(
    syncExerciseRepositoryMutationOptions(),
    {
      notify: true,
      method: "POST",
      successMessage: t("exercise-repositories-sync-queued"),
    },
    {
      onSuccess: () => {
        exerciseRepositories.refetch()
      },
    },
  )

  const renderContent = (repositories: ExerciseRepository[]) => (
    <>
      {addingRepo ? (
        <AddExerciseRepositoryForm
          courseId={courseId}
          examId={examId}
          onSuccess={() => {
            setAddingRepo(false)
            exerciseRepositories.refetch()
          }}
          onCancel={() => {
            setAddingRepo(false)
          }}
        />
      ) : (
        <Button
          size="medium"
          variant="primary"
          onClick={() => {
            setAddingRepo(true)
          }}
        >
          {t("exercise-repositories-add")}
        </Button>
      )}
      <ul>
        {repositories.map((er) => (
          <li key={er.id}>
            {editingRepo === er.id ? (
              <EditExerciseRepositoryForm
                exerciseRepository={er}
                onSuccess={() => {
                  exerciseRepositories.refetch()
                  setEditingRepo(null)
                }}
                onCancel={() => setEditingRepo(null)}
                onDelete={() =>
                  deleteMutation.mutate({
                    path: {
                      id: er.id,
                    },
                  })
                }
              />
            ) : (
              <>
                {t("url")}: {er.url}
                <br />
                {er.branch && (
                  <>
                    {t("exercise-repositories-branch")}: {er.branch}
                    <br />
                  </>
                )}
                {t("status")}: {er.status === "Success" && t("exercise-repositories-processed")}
                {er.status === "Pending" &&
                  (er.error_message
                    ? t("exercise-repositories-retrying", {
                        attempt: er.sync_attempts,
                        error: er.error_message,
                      })
                    : t("exercise-repositories-processing"))}
                {er.status === "Failure" &&
                  t("exercise-repositories-processing-failed") + ": " + er.error_message}
                <br />
                {t("exercise-repositories-used-by-tasks", { count: er.exercise_task_count })}
                {er.last_synced_at && er.last_sync_report && (
                  <details>
                    <summary>
                      {t("exercise-repositories-last-sync", {
                        time: dateToString(er.last_synced_at),
                      })}
                    </summary>
                    <SyncReport report={er.last_sync_report} />
                  </details>
                )}
                <Button size="medium" variant="tertiary" onClick={() => setEditingRepo(er.id)}>
                  {t("edit")}
                </Button>
                <Button
                  size="medium"
                  variant="tertiary"
                  disabled={er.status === "Pending" || syncMutation.isPending}
                  onClick={() => syncMutation.mutate({ path: { id: er.id } })}
                >
                  {t("refresh")}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )

  return (
    <QueryResult query={exerciseRepositories} treatEmptyAsData>
      {(repositories) => renderContent(repositories)}
    </QueryResult>
  )
}

const CourseExerciseRepositories: React.FC<{ courseId: string; examId: string | null }> = ({
  courseId,
  examId,
}) => {
  const exerciseRepositories = useQuery({
    ...getExerciseRepositoriesForCourseOptions({
      path: {
        course_id: courseId,
      },
    }),
    refetchInterval: refetchWhilePending,
  })

  return (
    <ExerciseRepositoriesContent
      courseId={courseId}
      examId={examId}
      exerciseRepositories={exerciseRepositories}
    />
  )
}

const ExamExerciseRepositories: React.FC<{ courseId: string | null; examId: string }> = ({
  courseId,
  examId,
}) => {
  const exerciseRepositories = useQuery({
    ...getExerciseRepositoriesForExamOptions({
      path: {
        exam_id: examId,
      },
    }),
    refetchInterval: refetchWhilePending,
  })

  return (
    <ExerciseRepositoriesContent
      courseId={courseId}
      examId={examId}
      exerciseRepositories={exerciseRepositories}
    />
  )
}

const ExerciseRepositories: React.FC<Props> = ({ courseId, examId }) => {
  if (courseId) {
    return <CourseExerciseRepositories courseId={courseId} examId={examId} />
  }

  if (examId) {
    return <ExamExerciseRepositories courseId={courseId} examId={examId} />
  }

  return null
}

export default ExerciseRepositories
