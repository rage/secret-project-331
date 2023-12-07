import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  deleteExerciseRepository,
  getExerciseRepositories,
} from "../../../../../../services/backend/exercise-repositories"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"

import AddExerciseRepositoryForm from "./AddExerciseRepositoryForm"
import EditExerciseRepositoryForm from "./EditExerciseRepositoryForm"

interface Props {
  courseId: string | null
  examId: string | null
}

const ExerciseRepositories: React.FC<Props> = ({ courseId, examId }) => {
  const { t } = useTranslation()

  const [addingRepo, setAddingRepo] = useState(false)
  const [editingRepo, setEditingRepo] = useState<string | null>(null)
  const exerciseRepositories = useQuery({
    queryKey: ["manage-exercise-repositories", courseId, examId],
    queryFn: async () => {
      return await getExerciseRepositories(courseId, examId)
    },
    onSuccess: () => {
      setAddingRepo(false)
    },
  })
  const deleteMutation = useToastMutation(
    deleteExerciseRepository,
    {
      notify: true,
      method: "POST",
      successMessage: t("exercise-repositories-deleted"),
    },
    {
      onSuccess: () => {
        setEditingRepo(null)
        exerciseRepositories.refetch()
      },
    },
  )

  if (exerciseRepositories.isPending) {
    return <div>{t("loading-text")}</div>
  } else if (exerciseRepositories.isError) {
    return <ErrorBanner error={exerciseRepositories.error} variant={"readOnly"} />
  }

  return (
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
        {exerciseRepositories.data.map((er) => (
          <li key={er.id}>
            {editingRepo === er.id ? (
              <EditExerciseRepositoryForm
                exerciseRepository={er}
                onSuccess={() => {
                  exerciseRepositories.refetch()
                  setEditingRepo(null)
                }}
                onCancel={() => setEditingRepo(null)}
                onDelete={() => deleteMutation.mutate(er.id)}
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
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export default ExerciseRepositories
