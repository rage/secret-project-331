import { useEffect } from "react"

import { WidgetReducerState } from "../components/widget"
import { CurrentStateMessage } from "../shared-module/iframe-protocol-types"

const CURRENT_STATE = "current-state"

export const useSendQuizAnswerOnChange = (port: MessagePort, state: WidgetReducerState): void => {
  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      message: CURRENT_STATE,
      data: state.quiz_answer,
      valid: state.quiz_answer_is_valid,
    }
    // eslint-disable-next-line i18next/no-literal-string
    console.info("Sending current data", JSON.stringify(message))
    port.postMessage(message)
  }, [port, state])
}
