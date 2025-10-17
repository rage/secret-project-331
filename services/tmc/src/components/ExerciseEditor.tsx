"use client"
/* eslint-disable i18next/no-literal-string */
import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
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
    // no exercise selected yet
    const repositoryExercises = state.repository_exercises?.length ?? 0
    return (
      <>
        {repositoryExercises > 0 && <div>{t("select-repository-exercise")}</div>}
        {repositoryExercises == 0 && <div>No repository exercises found.</div>}
        <ul>
          {state.repository_exercises?.map((re) => (
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
          Select another repository exercise
        </Button>
      </div>
    )
  }
}

export default ExerciseEditor
