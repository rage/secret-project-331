"use client"

import { useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import AddExerciseRepositoryForm from "./AddExerciseRepositoryForm"
import EditExerciseRepositoryForm from "./EditExerciseRepositoryForm"

import {
  deleteExerciseRepositoryMutation as deleteExerciseRepositoryMutationOptions,
  getExerciseRepositoriesForCourseOptions,
  getExerciseRepositoriesForExamOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseRepository } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { QueryResult } from "@/shared-module/components"

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
                {t("status")}: {er.status === "Success" && t("exercise-repositories-processed")}
                {er.status === "Pending" && t("exercise-repositories-processing")}
                {er.status === "Failure" &&
                  t("exercise-repositories-processing-failed") + ": " + er.error_message}
                <br />
                <Button size="medium" variant="tertiary" onClick={() => setEditingRepo(er.id)}>
                  {t("edit")}
                </Button>
                <Button
                  size="medium"
                  variant="tertiary"
                  onClick={() => {
                    // todo refresh repo
                  }}
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
    <QueryResult query={exerciseRepositories} emptyFallback={renderContent([])}>
      {(repositories) => renderContent(repositories)}
    </QueryResult>
  )
}

const CourseExerciseRepositories: React.FC<{ courseId: string; examId: string | null }> = ({
  courseId,
  examId,
}) => {
  const exerciseRepositories = useQuery(
    getExerciseRepositoriesForCourseOptions({
      path: {
        course_id: courseId,
      },
    }),
  )

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
  const exerciseRepositories = useQuery(
    getExerciseRepositoriesForExamOptions({
      path: {
        exam_id: examId,
      },
    }),
  )

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
