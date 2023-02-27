/* eslint-disable i18next/no-literal-string */
import { useEffect } from "react"

import { WidgetReducerState } from "../components/widget"
import { CurrentStateMessage } from "../shared-module/exercise-service-protocol-types"

const CURRENT_STATE = "current-state"

export const useSendQuizAnswerOnChange = (port: MessagePort, state: WidgetReducerState): void => {
  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      message: CURRENT_STATE,
      data: { private_spec: state.quiz_answer },
      valid: state.quiz_answer_is_valid,
    }

    console.groupCollapsed("Quizzes: sending current data")
    console.info(JSON.stringify(message, undefined, 2))
    console.groupEnd()
    port.postMessage(message)
  }, [port, state])
}
