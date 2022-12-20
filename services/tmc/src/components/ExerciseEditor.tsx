/* eslint-disable i18next/no-literal-string */
import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import CheckBox from "../shared-module/components/InputFields/CheckBox"
import { ExerciseEditorState, IframeState } from "../util/stateInterfaces"

interface Props {
  state: ExerciseEditorState
  setState: Dispatch<SetStateAction<IframeState | null>>
  port: MessagePort
}

const ExerciseEditor: React.FC<React.PropsWithChildren<Props>> = ({ state, setState }) => {
  const { t } = useTranslation()

  const setStateWrapper = (updater: (oldState: ExerciseEditorState) => ExerciseEditorState) => {
    setState((oldState) => {
      if (oldState?.viewType === "exercise-editor") {
        return updater(oldState)
      } else {
        return null
      }
    })
  }

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
          label={t("solve-in-editor")}
          checked={state.privateSpec?.type === "editor"}
          onChange={() =>
            setStateWrapper((old) => {
              return {
                ...old,
                privateSpec: {
                  type: "editor",
                  repositoryExercise: repositoryExercise,
                },
              }
            })
          }
        />
        <CheckBox
          label={t("solve-in-browser")}
          checked={state.privateSpec?.type === "browser"}
          onChange={() =>
            setStateWrapper((old) => {
              return {
                ...old,
                privateSpec: {
                  type: "browser",
                  repositoryExercise: repositoryExercise,
                },
              }
            })
          }
        />
        <Button
          variant="primary"
          size="medium"
          onClick={() =>
            setStateWrapper((state) => {
              return { ...state, privateSpec: null }
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
