import React, { Dispatch, SetStateAction, useEffect } from "react"
import { useTranslation } from "react-i18next"

import CheckBox from "../shared-module/components/InputFields/CheckBox"
import { CurrentStateMessage } from "../shared-module/exercise-service-protocol-types"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import withNoSsr from "../shared-module/utils/withNoSsr"
import { PrivateSpec, State } from "../util/stateInterfaces"

interface Props {
  state: State | null
  setState: Dispatch<SetStateAction<State | null>>
  port: MessagePort | null
}

export const StateRenderer: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  port,
}) => {
  const { t } = useTranslation()

  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      data: { private_spec: state?.viewType === "exercise-editor" ? state.privateSpec : null },
      // eslint-disable-next-line i18next/no-literal-string
      message: "current-state",
      valid: true,
    }
    port.postMessage(message)
  }, [state, port])

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.viewType === "answer-exercise") {
    // student exercise view
    if (state.publicSpec.type === "browser") {
      // "inline" exercise, solved in the browser
      return <div>{t("solve-in-browser")}</div>
    } else if (state.publicSpec.type === "editor") {
      // solved in an external editor
      return <div>{t("solve-in-editor")}</div>
    }
  } else if (state.viewType === "exercise-editor") {
    // cms editor view
    const repositoryExercise = state.selectedRepositoryExercise
    if (repositoryExercise == null) {
      // no exercise selected yet
      return <>{t("select-repository-exercise")}</>
    } else {
      return (
        <div>
          {t("selected-repository-exercise")}
          <br />
          {repositoryExercise.part} / {repositoryExercise.name}
          <br />
          {repositoryExercise.repository_url}
          <br />
          {repositoryExercise.download_url}
          {state.privateSpec?.type}
          <br />
          <CheckBox
            label={t("solve-in-editor")}
            checked={state.privateSpec?.type === "editor"}
            onChange={() =>
              setState((old) => {
                if (old === null || old.viewType !== "exercise-editor" || old.privateSpec == null) {
                  return old
                }
                const privateSpec: PrivateSpec | null = old.privateSpec
                  ? { ...old.privateSpec, type: "editor" }
                  : null
                return { ...old, privateSpec }
              })
            }
          />
          <CheckBox
            label={t("solve-in-browser")}
            checked={state.privateSpec?.type === "browser"}
            onChange={() =>
              setState((old) => {
                if (old === null || old.viewType !== "exercise-editor" || old.privateSpec == null) {
                  return old
                }
                const privateSpec: PrivateSpec | null = old.privateSpec
                  ? { ...old.privateSpec, type: "browser" }
                  : null
                return { ...old, privateSpec }
              })
            }
          />
        </div>
      )
    }
  } else if (state.viewType === "view-submission") {
    // submission view
    if (state.userAnswer.type === "browser") {
      return <code>{state.userAnswer.fileContents}</code>
    } else if (state.userAnswer.type === "editor") {
      return (
        <>
          {state.userAnswer.answerFiles.map((f) => (
            <>
              <div>{f.fileName}</div>
              <code>{f.fileContents}</code>
            </>
          ))}
        </>
      )
    }
  }

  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(StateRenderer))
