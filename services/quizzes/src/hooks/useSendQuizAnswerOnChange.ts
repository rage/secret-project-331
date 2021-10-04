import { useEffect } from "react"

import { State } from "../components/widget"
import { CurrentStateMessage } from "../shared-module/iframe-protocol-types"

export const useSendQuizAnswerOnChange = (port: MessagePort, state: State): void => {
  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      message: "current-state",
      data: state.quiz_answer,
      valid: state.quiz_answer_is_valid,
    }
    console.info("Sending current data", JSON.stringify(message))
    port.postMessage(message)
  }, [port, state])
}
