/* eslint-disable i18next/no-literal-string */
import React from "react"
import { useTranslation } from "react-i18next"

import { ExerciseEditorState, ExerciseIframeState } from "../util/stateInterfaces"

import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"

interface Props {
  state: ExerciseEditorState
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
}

const ExerciseEditor: React.FC<React.PropsWithChildren<Props>> = ({ state, setState }) => {
  const { t } = useTranslation()

  // cms editor view
  if (state.privateSpec == null) {
    // no exercise selected yet
    return (
      <>
        <div>{t("select-repository-exercise")}</div>
        <ul>
          {state.repositoryExercises?.map((re) => (
            <li key={re.id}>
              <Button
                variant="primary"
                size="medium"
                onClick={() =>
                  setState((state) => {
                    if (state?.viewType === "exercise-editor") {
                      return {
                        ...state,
                        privateSpec: {
                          type: "editor",
                          repositoryExercise: re,
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
    const repositoryExercise = state.privateSpec.repositoryExercise
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
        {state.privateSpec?.type}
        <br />
        <CheckBox
          label={t("solve-in-editor-label")}
          checked={state.privateSpec?.type === "editor"}
          onChange={() =>
            setState((old) => {
              if (old) {
                return {
                  ...old,
                  privateSpec: {
                    type: "editor",
                    repositoryExercise: repositoryExercise,
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
          checked={state.privateSpec?.type === "browser"}
          onChange={() =>
            setState((old) => {
              if (old) {
                return {
                  ...old,
                  privateSpec: {
                    type: "browser",
                    repositoryExercise: repositoryExercise,
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
                return { ...old, privateSpec: null }
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
