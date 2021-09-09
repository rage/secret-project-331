import { useEffect } from "react"

import { State } from "../components/widget"

export const useSendQuizAnswerOnChange = (port: MessagePort, state: State): void => {
  useEffect(() => {
    if (!port) {
      return
    }
    const message = {
      message: "current-state",
      data: state.quiz_answer,
    }
    console.info("Sending current data", JSON.stringify(message))
    port.postMessage(message)
  }, [port, state])
}
