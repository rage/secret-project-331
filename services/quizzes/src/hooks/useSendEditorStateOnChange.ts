/* eslint-disable i18next/no-literal-string */
import { useEffect } from "react"

import { CurrentStateMessage } from "../shared-module/exercise-service-protocol-types"
import { StoreState } from "../store/store"
import { denormalizeData } from "../util/normalizerFunctions"

const CURRENT_STATE = "current-state"

export const useSendEditorStateOnChange = (port: MessagePort, state: StoreState): void => {
  useEffect(() => {
    if (!port) {
      return
    }

    const message: CurrentStateMessage = {
      message: CURRENT_STATE,
      data: { private_spec: denormalizeData(state) },
      valid: true,
    }
    console.groupCollapsed("Quizzes: sending current data")
    console.info(JSON.stringify(message, undefined, 2))
    console.groupEnd()
    port.postMessage(message)
  }, [state, port])
}
