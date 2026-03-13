"use client"

/* eslint-disable i18next/no-literal-string */

import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import Spinner from "@/shared-module/common/components/Spinner"
import { ExerciseEditorState, ExerciseIframeState } from "@/util/stateInterfaces"

interface Props {
  state: ExerciseEditorState
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  requestRepositoryExercises: () => void
}

const ExerciseEditor: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  requestRepositoryExercises,
}) => {
  const { t } = useTranslation()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => requestRepositoryExercises(), [])

  // cms editor view
  if (state.private_spec == null) {
    // no exercise selected yet: treat null/undefined as loading, [] as empty
    const repository_exercises = state.repository_exercises
    if (repository_exercises === null || repository_exercises === undefined) {
      return <Spinner />
    }
    const hasExercises = repository_exercises.length > 0
    return (
      <>
        {hasExercises && <div>{t("select-repository-exercise")}</div>}
        {!hasExercises && <div>{t("no-repository-exercises-found")}</div>}
        <ul>
          {repository_exercises.map((re) => (
            <li key={re.id}>
              <Button
                variant="primary"
                size="medium"
                onClick={() =>
                  setState((state) => {
                    if (state?.view_type === "exercise-editor") {
                      return {
                        ...state,
                        private_spec: {
                          type: "editor",
                          repository_exercise: re,
                        },
                      }
                    } else {
                      return null
                    }
                  })
                }
              >
                {re.part} / {re.name} ({re.repository_url})
              </Button>
            </li>
          ))}
        </ul>
      </>
    )
  } else {
    // exercise selected
    const repositoryExercise = state.private_spec.repository_exercise
    return (
      <div>
        {t("selected-repository-exercise")}
        <br />
        {repositoryExercise.part} / {repositoryExercise.name}
        <br />
        {repositoryExercise.repository_url}
        <br />
        {repositoryExercise.download_url}
        <br />
        {state.private_spec?.type}
        <br />
        <CheckBox
          label={t("solve-in-editor-label")}
          checked={state.private_spec?.type === "editor"}
          onChange={() =>
            setState((old) => {
              if (old) {
                return {
                  ...old,
                  private_spec: {
                    type: "editor",
                    repository_exercise: repositoryExercise,
                  },
                }
              } else {
                return null
              }
            })
          }
        />
        <CheckBox
          label={t("solve-in-browser")}
          checked={state.private_spec?.type === "browser"}
          onChange={() =>
            setState((old) => {
              if (old) {
                return {
                  ...old,
                  private_spec: {
                    type: "browser",
                    repository_exercise: repositoryExercise,
                  },
                }
              } else {
                return null
              }
            })
          }
        />
        <Button
          variant="primary"
          size="medium"
          onClick={() =>
            setState((old) => {
              if (old) {
                return { ...old, private_spec: null }
              } else {
                return null
              }
            })
          }
        >
          {t("select-another-repository-exercise")}
        </Button>
      </div>
    )
  }
}

export default ExerciseEditor
