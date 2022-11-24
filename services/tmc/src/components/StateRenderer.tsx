/* eslint-disable i18next/no-literal-string */
import React, { Dispatch, SetStateAction, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { CurrentStateMessage } from "../shared-module/exercise-service-protocol-types"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import withNoSsr from "../shared-module/utils/withNoSsr"
import { IframeState } from "../util/stateInterfaces"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission from "./ViewSubmission"

interface Props {
  state: IframeState | null
  setState: Dispatch<SetStateAction<IframeState | null>>
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

  if (state.viewType === "exercise-editor") {
    return <ExerciseEditor state={state} setState={setState} port={port} />
  } else if (state.viewType === "answer-exercise") {
    return (
      <AnswerExercise
        port={port}
        publicSpec={state.publicSpec}
        initialPublicSpec={state.initialPublicSpec}
      />
    )
  } else if (state.viewType === "view-submission") {
    return <ViewSubmission state={state} />
  }

  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(StateRenderer))
